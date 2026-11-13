/**
 * 雷霆路径。默认关闭，只有 SPINE_THUNDER=1 才走。
 * Thunder path. Off unless SPINE_THUNDER=1.
 * 只做一次模型读取。不要先附上全文再改成少发。
 * One model read only. Never attach the full history and then send less.
 */

const PROSE_TOKEN_CAP = 32000;

export function sharedPrefixLength(previous, next) {
  if (!previous || !next) return 0;
  const limit = Math.min(previous.length, next.length);
  let index = 0;
  const step = 64;
  while (index + step <= limit && previous.slice(index, index + step) === next.slice(index, index + step)) index += step;
  while (index < limit && previous[index] === next[index]) index += 1;
  return index;
}

// 前缀没变才考虑少发。变了就整段重发，不要先附上全文再改口。
// Send less only when the prefix is unchanged. If it changed, send the whole request.
export function decideThunder({ previous, next, modelKind, prefixTokens, attachMaxTokens = 80000 }) {
  if (!previous || !next) return "send-less";
  const shared = sharedPrefixLength(previous, next);
  const ratio = shared / Math.max(previous.length, 1);
  if (ratio < 0.9) return "send-less";
  if (modelKind === "27b" && (prefixTokens || 0) > attachMaxTokens) return "send-less";
  return "attach";
}

function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(cjk / 1.5 + (text.length - cjk) / 4);
}

export function buildSendLess({ taskLine, uncovered, facts, proseTokens = PROSE_TOKEN_CAP }) {
  const kept = (facts || []).filter(Boolean).map((fact) => {
    if (typeof fact === "object" && fact !== null) {
      const role = String(fact.role || "unknown");
      const line = String(fact.line || "");
      return line ? `[${role}] ${line}` : "";
    }
    return `[unknown] ${String(fact)}`;
  }).filter(Boolean);
  let prose = uncovered || "";
  if (estimateTokens(prose) > proseTokens) {
    let low = 0;
    let high = prose.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (estimateTokens(prose.slice(0, mid)) <= proseTokens) low = mid;
      else high = mid - 1;
    }
    prose = prose.slice(0, low);
  }
  return [
    taskLine || "Continue the current task.",
    "Facts already copied locally:",
    ...(kept.length ? kept.map((fact) => `- ${fact}`) : ["- (none)"]),
    "Uncovered prose to summarize:",
    prose || "(none)",
  ].join("\n");
}
