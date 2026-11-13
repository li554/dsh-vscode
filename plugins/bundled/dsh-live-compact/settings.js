/** 设置系统 */

/** 用户可调项。默认值与 1.1.1 的行为完全一致：不配置就一切照旧。 */
export const DEFAULTS = Object.freeze({
  minTokens: 20000, // 轮后小切的起点
  keepRounds: 3, // 原处保留的最近已结束工具轮数
  keepRoundTokens: 32000, // 云端收尾停止线
  pointerTokens: 0, // 0 = 跟随 chunkMax
  chunkMin: 1000, // 不够这一刀就不切
  chunkMax: 32000, // 一刀上限，等于卡片轨道
  bigGate: 650000, // 绝对停切线
  cooldownMs: 0, // 0 = 只用 seq 一次性跳过
});

/** 旧的环境变量仍然有效，但只作为 config 缺席时的兜底。 */
export const ENV = Object.freeze({
  minTokens: "SPINE_MIN_TOKENS",
  keepRounds: "SPINE_KEEP_ROUNDS",
  keepRoundTokens: "SPINE_KEEP_ROUND_TOKENS",
  pointerTokens: "SPINE_POINTER_TOKENS",
  chunkMin: "SPINE_CHUNK_MIN",
  chunkMax: "SPINE_CHUNK_MAX",
  cooldownMs: "SPINE_COOLDOWN_MS",
});

// volatile 字段的现值是 cosmokit 的取值对象，读之前先摊平。
const plain = (value) => (value && typeof value === "object" && typeof value.get === "function" ? value.get() : value);

/** 预设加载时取得独立快照；未配置的 volatile 引用不能覆盖较低优先级的值。 */
export function configSnapshot(config = {}) {
  return Object.fromEntries(Object.entries(config ?? {}).flatMap(([key, value]) => {
    const current = plain(value);
    return current == null ? [] : [[key, current]];
  }));
}

export const ENGINE_DEFAULTS = Object.freeze({
  auto: true,
  thresholdRatio: 0.8,
  headroomTokens: 65536,
  retainTokens: 8192,
  compactionRetries: 0,
});

const ENGINE_ENV = Object.freeze({
  thresholdRatio: "SPINE_THRESHOLD_RATIO",
  headroomTokens: "SPINE_HEADROOM_TOKENS",
  retainTokens: "SPINE_RETAIN_TOKENS",
});
const PLUGIN_KEYS = new Set(["takeoverPresets", ...Object.keys(DEFAULTS)]);

/** 只剥离本插件字段；其余字段（包括未知键）交给实际安装的 stock 校验。 */
export function engineConfig(config = {}, env = process.env) {
  const next = {};
  for (const [key, value] of Object.entries(config ?? {})) {
    if (!PLUGIN_KEYS.has(key)) next[key] = plain(value);
  }
  for (const [key, fallback] of Object.entries(ENGINE_DEFAULTS)) {
    // retainRatio / retainTokens 是宿主互斥选项，不能用默认 token 数盖掉显式比例。
    if (key === "retainTokens" && next.retainRatio != null) continue;
    const envName = ENGINE_ENV[key];
    if (next[key] == null) next[key] = finite(envName ? env?.[envName] : undefined) ?? fallback;
  }
  return next;
}

const finite = (value) => {
  const source = plain(value);
  if (typeof source !== "number" && typeof source !== "string") return undefined;
  if (typeof source === "string" && !source.trim()) return undefined;
  const number = Number(source);
  return Number.isFinite(number) ? number : undefined;
};

export function readSettings(config = {}, env = process.env) {
  const next = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const envName = ENV[key];
    const numeric = (value) => {
      const number = finite(value);
      return key === "keepRounds" && (!Number.isInteger(number) || number < 1) ? undefined : number;
    };
    next[key] =
      numeric(config?.[key]) ?? numeric(envName ? env?.[envName] : undefined) ?? fallback;
  }
  if (!next.pointerTokens) next.pointerTokens = next.chunkMax;
  return Object.freeze(next);
}

/**
 * 复用实际安装的 stock schema，保留宿主字段和校验，不修改原 schema。
 * 每个字段都要 .volatile()：宿主的设置界面只列出 volatile 字段，漏一个就整份表单不出现。
 * 数值字段不注入 schema 默认值，保留“未显式配置”的状态，运行时才解析环境变量和默认值。
 */
export function configSchema(z, stockSchema) {
  const count = (min) => z.number().step(1).min(min);
  const stockFields = stockSchema?.dict ?? {
    auto: z.boolean(),
    thresholdRatio: z.number(),
    headroomTokens: count(0),
    retainTokens: count(0),
    compactionRetries: count(0),
  };
  return z.object({
    ...Object.fromEntries(Object.entries(stockFields).map(([key, field]) => [
      key, field.meta?.volatile ? field : z(field).volatile(),
    ])),
    takeoverPresets: z.boolean().default(true)
      .description("接管官方预设中的压缩引擎；修改后只影响新加载的预设，已有会话需重建。")
      .volatile(),
    minTokens: count(0)
      .description("轮后小切的起点，上下文到这个 token 数才切一刀。")
      .volatile(),
    keepRounds: count(1)
      .description("最近几个已结束的工具轮留在原文，至少 1 轮，默认 3。")
      .volatile(),
    keepRoundTokens: count(0)
      .description("云端收尾停止线，降到这个 token 数以下就不再切。")
      .volatile(),
    pointerTokens: count(0)
      .description("单个工具结果超过这个 token 数只留指针；0 = 跟随 chunkMax。")
      .volatile(),
    chunkMin: count(0)
      .description("一刀的最小量，不够就不切，避免每轮一张碎卡片。")
      .volatile(),
    chunkMax: count(1)
      .description("一刀的最大量，和卡片轨道同为 32000。")
      .volatile(),
    bigGate: count(1)
      .description("绝对停切线，超过就不再做小切，交给官方大压缩。")
      .volatile(),
    cooldownMs: count(0)
      .description("官方压缩之后跳过小切的时间窗；0 = 只按事件序号跳过一次。")
      .volatile(),
  });
}
