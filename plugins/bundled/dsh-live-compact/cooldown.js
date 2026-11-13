// cooldown.js — 「某类系统事件刚发生过，先让一让」的通用判定
//
// 【为什么单独成文件】
// 这个判断与压缩引擎、卡片格式、切块选择无关，只读取会话节点、恢复边界和
// `source.kind`。放成独立文件后：
//   · 调用方（index.js）只加一行判定，不碰任何既有逻辑
//   · 不 import 宿主包；只有一次性跳过 helper 共享 Session 弱引用记录，以支持热重载
//
// 【两个判据，主判据是「这条官方卡片处理过没有」】
// 只看时间窗口会漏掉一种真实情形：官方压缩后长时间没消息（比如一小时），再来消息时
// 窗口早过了，spine 立刻切——而那正是要挡的一刀（官方摘要还在 surface 里，容易被卷走）。
// 所以主判据用 seq：每出现一条实时的新官方卡片，就跳过一次动作并记住该 seq；
// 恢复边界之前的历史卡片只建立基线，不再跳过。同一条实时卡片只跳一次。
// 时间窗口作为可选的额外兜底（`SPINE_COOLDOWN_MS`，默认 0 = 只用 seq 语义），
// 用于「压缩后短时间内反复 idle」的场景。
// 两者都不引入轮次概念——轮次要定义「什么算一轮」「中断算不算」，成本高且难测。

/** 默认冷却窗口：5 分钟。具名常量，不散落魔数。 */
export const DEFAULT_COOLDOWN_MS = 300000;

/** 官方压缩卡片使用的 `source.kind`（宿主契约字段，不是文本标记）。 */
export const OFFICIAL_COMPACTION_KIND = "compact-checkpoint";

// Session identity survives engine/preset replacement, LRU eviction and module
// hot reload. Weak keys retain no completed Session, and nothing is persisted.
const seenKey = Symbol.for("dsh-live-compact.official-compaction-seen");
const officialSeen = globalThis[seenKey] ??= new WeakMap();

export function skipLiveOfficialCompaction(session) {
  const seq = lastSourceKindSeq(session, OFFICIAL_COMPACTION_KIND);
  if (seq === undefined || officialSeen.get(session) === seq) return false;
  officialSeen.set(session, seq);
  const boundary = session.firstLiveSeq;
  // Older hosts without a valid lifecycle boundary keep once-per-card
  // behavior. Never infer history from timestamps or captureNew replay.
  const knownBoundary = Number.isSafeInteger(boundary) && boundary >= 0;
  return !knownBoundary || seq >= boundary;
}

/**
 * 解析冷却窗口配置。
 * @param {Record<string, string|undefined>} [env] 环境变量表（测试可注入）
 * @returns {number} 毫秒；**0 表示关闭时间窗口**（负数同样视为关闭）
 */
export function resolveCooldownMs(env = process.env) {
  const raw = Number(env?.SPINE_COOLDOWN_MS);
  if (!Number.isFinite(raw)) return 0;
  return raw <= 0 ? 0 : Math.floor(raw);
}

/**
 * 会话里「最近一次指定 source.kind 的节点」距今多少毫秒。
 *
 * 从 surface 尾部往前找第一条匹配的 `user/message`：只读 `session.surface.nodes` 与
 * `session.eventAt(seq)` 这两个宿主稳定接口，因此对任何"会在会话里留下卡片"的机制都适用。
 *
 * @param {object} session 宿主会话（需有 surface.nodes 与 eventAt）
 * @param {string} kind 目标 `source.kind`
 * @param {number} [now] 当前时间（毫秒），便于测试注入
 * @returns {number} 毫秒；找不到返回 `Infinity`（视为"从未发生"）
 */
export function lastSourceKindAgeMs(session, kind, now = Date.now()) {
  const nodes = session?.surface?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return Infinity;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const event = session.eventAt?.(nodes[index]);
    if (event?.type !== "user/message") continue;
    if (event?.data?.source?.kind !== kind) continue;
    const time = event.time;
    if (typeof time !== "number") return Infinity;
    return Math.max(0, now - time);
  }
  return Infinity;
}

/**
 * 会话里「最近一次指定 source.kind 的节点」的 seq。
 *
 * 比时间更可靠的判据：只要出现**新的**官方卡片，seq 就会变；与消息间隔多久无关。
 *
 * @param {object} session 宿主会话（需有 surface.nodes 与 eventAt）
 * @param {string} kind 目标 `source.kind`
 * @returns {number|undefined} seq；找不到返回 undefined
 */
export function lastSourceKindSeq(session, kind) {
  const nodes = session?.surface?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const seq = nodes[index];
    const event = session.eventAt?.(seq);
    if (event?.type !== "user/message") continue;
    if (event?.data?.source?.kind !== kind) continue;
    return seq;
  }
  return undefined;
}

/**
 * 官方压缩卡片的年龄（毫秒）。
 * @param {object} session 宿主会话
 * @param {number} [now] 当前时间，便于测试注入
 * @returns {number} 毫秒；没有官方卡片返回 `Infinity`
 */
export function officialCompactionAgeMs(session, now = Date.now()) {
  return lastSourceKindAgeMs(session, OFFICIAL_COMPACTION_KIND, now);
}

/**
 * 是否处在冷却期——是则调用方本轮应当跳过动作。
 *
 * @param {object} session 宿主会话
 * @param {{windowMs?: number, now?: number, kind?: string}} [options]
 *        windowMs ≤ 0 表示关闭（恒返回 false）；kind 缺省为官方压缩卡片
 * @returns {boolean} true = 刚发生过，本轮让一让
 */
export function inCooldown(session, options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_COOLDOWN_MS;
  if (!(windowMs > 0)) return false;
  const kind = options.kind ?? OFFICIAL_COMPACTION_KIND;
  const now = options.now ?? Date.now();
  return lastSourceKindAgeMs(session, kind, now) < windowMs;
}
