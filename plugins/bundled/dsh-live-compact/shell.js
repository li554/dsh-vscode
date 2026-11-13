/**
 * 薄入口。这个文件必须能求值，引擎加载失败也不能把这里抛掉。
 * Thin entry. This file must evaluate even when the engine cannot load.
 * A throw here leaves stock disabled and /compact waiting.
 *
 * 预检查只解析配置，校验交给实际引擎；构造失败时释放本次注册，不重试原版盖掉报错。
 * Resolve config before construction; let the engine validate it and preserve its actual error.
 */
import { loadBase, loadCompaction, loadSchema } from "./adapter.js";
import { configSchema, engineConfig } from "./settings.js";
import { installPresetGate } from "./gate.js";

let Engine = null;
let Stock = null;
let CompactionEngine = null;
let ManualCompactionError = null;
let loadError = null;
let Schema = null;

if (process.env.SPINE_ENGINE_FAIL === "import") {
  loadError = new Error("spine: engine import refused");
} else {
  try {
    const engine = await import("./index.js");
    Engine = engine.default;
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
  }
}

try {
  const compaction = await loadCompaction();
  CompactionEngine = compaction.CompactionEngine;
  ManualCompactionError = compaction.ManualCompactionError;
} catch (error) {
  loadError ??= error instanceof Error ? error : new Error(String(error));
}

try {
  const stock = await loadBase();
  Stock = stock.BasicCompactionEngine;
} catch (error) {
  if (!loadError) loadError = error instanceof Error ? error : new Error(String(error));
}

// 官方设置界面按这份 schema 自动生成表单。拿不到 schemastery 就退回 stock 的 schema。
try {
  const schema = await loadSchema();
  Schema = configSchema(schema.default, Stock?.Config);
} catch {
  Schema = null;
}

function reasonText(error) {
  return error instanceof Error ? error.message : String(error);
}

export function preflightConfig(config = {}) {
  return engineConfig(config);
}

function compactionRecord(ctx) {
  const key = ctx?.[Symbol.for("cordis.isolate")]?.compaction;
  return key === undefined ? undefined : ctx?.reflect?.store?.[key];
}

function releaseCompaction(ctx, previous) {
  const store = ctx?.reflect?.store;
  const key = ctx?.[Symbol.for("cordis.isolate")]?.compaction;
  const current = compactionRecord(ctx);
  const currentFiber = current?.fiber ?? current?.ctx?.fiber;
  const contextFiber = ctx?.fiber;
  if (!current || current === previous || currentFiber !== contextFiber) return false;
  delete store[key];
  if (contextFiber?.store?.compaction === current) delete contextFiber.store.compaction;
  return true;
}

function visibleTakeover(ctx, reason) {
  const line = `spine: ${MARK}。${reason}`;
  console.error(line);
  ctx?.logger?.warn?.(line);
}

const MARK = "本会话未接管";

const UnavailableCompaction = CompactionEngine
  ? class extends CompactionEngine {
    constructor(ctx, reason) {
      super(ctx);
      this.reason = reason;
      ctx.logger?.warn?.(`spine: ${MARK}。压缩没有装上，这一刀没有执行。${reason}`);
    }

    compactIfNeeded() {
      return Promise.reject(new Error(`spine: ${MARK}。压缩没有装上，这一刀没有执行。${this.reason}`));
    }

    compactNow() {
      const message = `spine: ${MARK}。压缩没有装上，这一刀没有执行。${this.reason}`;
      if (ManualCompactionError) return Promise.reject(new ManualCompactionError("summary", message));
      return Promise.reject(new Error(message));
    }
  }
  : null;

export default class LiveCompactEntry {
  static inject = ["llm", "tokenMeter", "sessions"];
  static Config = Schema || Stock?.Config || Engine?.Config;

  constructor(ctx, config) {
    installPresetGate(ctx, config);
    const previousCompaction = compactionRecord(ctx);
    let cause = loadError;
    let resolvedConfig;
    let skipStock = process.env.SPINE_ENGINE_FAIL === "construct";
    if (skipStock) cause = new Error("spine: constructor refused");
    if (!loadError && !skipStock) {
      try {
        resolvedConfig = preflightConfig(config);
      } catch (error) {
        cause = error instanceof Error ? error : new Error(String(error));
        skipStock = true;
      }
    }
    if (!loadError && !skipStock && Engine) {
      try {
        return new Engine(ctx, config, resolvedConfig);
      } catch (error) {
        cause = error instanceof Error ? error : new Error(String(error));
        releaseCompaction(ctx, previousCompaction);
        skipStock = true;
      }
    }
    cause ??= new Error("spine: engine missing");
    if (!skipStock && process.env.SPINE_STOCK_FAIL !== "1" && Stock) {
      try {
        visibleTakeover(ctx, `这一轮用原版压缩。${reasonText(cause)}`);
        return new Stock(ctx, engineConfig(config));
      } catch (error) {
        cause = error instanceof Error ? error : new Error(String(error));
        releaseCompaction(ctx, previousCompaction);
      }
    }
    visibleTakeover(ctx, reasonText(cause));
    if (!UnavailableCompaction) throw new Error(`spine: ${MARK}。压缩接口没有装上。${reasonText(cause)}`);
    return new UnavailableCompaction(ctx, reasonText(cause));
  }
}
