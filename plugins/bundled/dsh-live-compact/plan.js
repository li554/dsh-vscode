const MARK = "Spine extract.";
const KEEP_BUDGET = 8000;
export const RAIL_TOKENS = 32000;
export const TRUNK_SCOPE = "dynamic-v1";
const LINE_TEST = 240;
const CODE = /^(?:diff --git|index [0-9a-f]{4,}|@@ |--- |\+\+\+ |def |class |function |fn |pub |impl |import |export |#include |package |const |let |var |async |return |Traceback\b|Error:|Exception:|panic!|FAILED\b|PASS\b)|^\s+at \S+|^(?:\$ |> )?(?:git|cargo|npm|bun|python3|pip|curl|make) /;
const PATH = /^[~./\w-]+\.(?:py|js|ts|tsx|go|rs|java|c|h|cc|cpp|md|json|yml|yaml)(?::\d+)?$/;
const RESEARCH = /(?:\barxiv:\d{4}\.\d{4,5}\b|\bdoi:\s*10\.\d{4,}\/|\b10\.\d{4,9}\/\S+|\b(?:lr|learning_rate|batch_size|temperature|top_p|max_tokens)\s*[=:]|^\$\$|\\(?:frac|sum|prod|alpha|beta|gamma|cdot)\b|^Figure \d|^Table \d|^Eq\.?\s*\d|\bsha256\b|\b[a-f0-9]{64}\b)/i;
const TABLE = /^\|.*\|$/;
const HARNESS = /web_search results are external|web_fetch returns external|Track every background job|Use the workflow tool ONLY|create_goal may infer|do not busy-poll/;
const OBLIGATION = /(?:\b(?:must|never|do not|don't|required|requires|preserve|preserving|shall not)\b|必须|不要|禁止|不能|不得|只能|保留)/i;
const TOKEN = /`([^`]{2,80})`|\b([A-Z][A-Za-z0-9]+(?:[A-Z][a-z0-9]+)+)\b|\b([a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+)\b|\b([a-z][a-z0-9]*(?:[_-][a-z0-9]+){1,})\b|\b([A-Za-z0-9_.-]+\.(?:py|js|ts|tsx|go|rs|java|c|h|cc|cpp|md|json|yml|yaml))\b|\b((?:~|\.{1,2})?\/[A-Za-z0-9_./+-]{3,})\b/g;
const IDENT_VERB = /`[^`]{2,80}`[\s\S]{0,80}\b(?:move|place|clear|preserve|require|requires|keep)\b|\b(?:move|place|clear|preserve|require|requires|keep)\b[\s\S]{0,80}`[^`]{2,80}`/i;
const ERROR_LINE = /^(?:Error:|Exception:|Traceback\b|FAILED\b|panic!)/;

function messageText(message) {
  const content = message?.content ?? message?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => (typeof block?.text === "string" ? block.text : "")).join("\n");
}

function isPadding(text) {
  if (!text) return false;
  const sample = text.length > 800 ? text.slice(0, 800) : text;
  const parts = sample.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 8) return false;
  const counts = new Map();
  let max = 0;
  for (const part of parts) {
    const next = (counts.get(part) || 0) + 1;
    counts.set(part, next);
    if (next > max) max = next;
  }
  return counts.size <= 3 || max / parts.length >= 0.6;
}

function probe(line) {
  const sample = line.length > LINE_TEST ? line.slice(0, LINE_TEST) : line;
  return CODE.test(sample) || PATH.test(sample) || RESEARCH.test(sample) || TABLE.test(sample);
}

export function repeatedNames(text) {
  const counts = new Map();
  for (const match of String(text || "").matchAll(TOKEN)) {
    const token = match.slice(1).find(Boolean);
    if (!token || token.length < 4) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count >= 2).map(([token]) => token));
}

export function compactionRoute(plan) {
  const chars = Math.max(1, plan?.chars || 0);
  const uncovered = plan?.uncovered?.length || 0;
  const proseRatio = uncovered / chars;
  if (uncovered >= 20000 && proseRatio >= 0.5) return "wait-80";
  if (uncovered < 20000 && proseRatio < 0.2) return "local";
  return "wait-80";
}

export function planText(text) {
  const covered = [];
  const uncovered = [];
  let fence = null;
  let codeLines = 0;
  const flushFence = () => {
    if (!fence) return;
    codeLines += fence.length;
    const body = fence.join("\n");
    covered.push(body.length > 1200 ? `${fence[0]}\n… ${fence.length} code lines …\n${fence.at(-1)}` : body);
    fence = null;
  };
  for (const raw of String(text).split("\n")) {
    const trimmed = raw.trim();
    if (fence) {
      fence.push(raw);
      if (trimmed.startsWith("```")) flushFence();
      continue;
    }
    if (trimmed.startsWith("```")) {
      fence = [raw];
      continue;
    }
    if (!trimmed || isPadding(trimmed)) continue;
    if (probe(trimmed)) {
      codeLines += 1;
      covered.push(trimmed.length > 300 ? `${trimmed.slice(0, 180)} …` : trimmed);
    } else uncovered.push(trimmed);
  }
  flushFence();
  return { covered, uncovered: uncovered.join("\n"), codeLines };
}

function collectText(node, bits) {
  if (!node) return;
  if (typeof node === "string") {
    bits.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, bits);
    return;
  }
  if (typeof node === "object") {
    if (typeof node.text === "string") bits.push(node.text);
    if (node.content) collectText(node.content, bits);
    if (node.message) collectText(node.message, bits);
  }
}

export function planTree(messages) {
  return planMessages((messages || []).map((message) => {
    const bits = [];
    collectText(message, bits);
    return {
      role: message?.role || message?.message?.role || "assistant",
      content: bits.join("\n"),
    };
  }));
}

export function hardItems(text) {
  const names = repeatedNames(text);
  const items = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || HARNESS.test(line)) continue;
    const named = [...names].filter((name) => line.includes(name));
    if (line.length > 400) {
      items.push(...named);
      continue;
    }
    if (named.length > 0 || OBLIGATION.test(line) || ERROR_LINE.test(line) || IDENT_VERB.test(line) || PATH.test(line)) {
      items.push(line);
    }
  }
  return [...new Set(items)];
}

export function buildCard(spanText, liveText = "") {
  const span = String(spanText || "");
  const live = String(liveText || "");
  const hard = hardItems(span);
  const split = planText(span);
  const kept = [];
  let used = 0;
  let omittedHard = 0;
  for (const line of hard) {
    if (live.includes(line)) continue;
    if (used + line.length > KEEP_BUDGET) {
      omittedHard += 1;
      continue;
    }
    kept.push(line);
    used += line.length;
  }
  let deferred = 0;
  for (const line of [...new Set(split.covered)]) {
    if (kept.includes(line) || live.includes(line)) continue;
    if (used + line.length > KEEP_BUDGET) {
      deferred += 1;
      continue;
    }
    kept.push(line);
    used += line.length;
  }
  const missing = hard.filter((line) => !live.includes(line) && !kept.includes(line));
  const verdict = missing.length === 0 ? "TRUNK CONFIRMED" : "TRUNK UNCONFIRMED";
  return {
    verdict,
    scope: TRUNK_SCOPE,
    hardLines: hard,
    hardCount: hard.length,
    omittedHard,
    deferred,
    missing,
    uncovered: split.uncovered,
    keptChars: used,
    text: [
      MARK,
      `${verdict} against ${TRUNK_SCOPE}.`,
      "Checked: names repeated in this chunk, obligation lines, and error headers. Unclassified prose is not claimed.",
      `Hard lines: ${hard.length}. Missing from card and live context: ${missing.length}. Deferred recoverable: ${deferred}.`,
      "Kept lines:",
      ...(kept.length === 0 ? ["- (none)"] : kept.map((line) => `- ${line}`)),
      "A shadow path is not live preservation. Read a deferred file before using it.",
    ].join("\n"),
  };
}

export function planMessages(messages) {
  const covered = [];
  const uncovered = [];
  const shortUsers = [];
  let chars = 0;
  let codeLines = 0;
  for (const message of messages) {
    const text = messageText(message);
    chars += text.length;
    const role = message?.role ?? message?.message?.role;
    if (role === "user" && text.length > 0 && text.length <= 280 && !text.startsWith(MARK)) {
      shortUsers.push(text.trim());
      continue;
    }
    const split = planText(text);
    covered.push(...split.covered);
    codeLines += split.codeLines;
    if (split.uncovered) uncovered.push(split.uncovered);
  }
  const unique = [...new Set(covered)];
  const kept = [];
  let used = 0;
  let omitted = 0;
  for (const line of unique) {
    if (used + line.length > KEEP_BUDGET) {
      omitted += 1;
      continue;
    }
    kept.push(line);
    used += line.length;
  }
  const prose = uncovered.join("\n");
  const joined = (messages || []).map(messageText).join("\n");
  const card = buildCard(joined, shortUsers.join("\n"));
  return {
    chars,
    codeLines,
    keptChars: card.keptChars,
    omitted,
    omittedHard: card.omittedHard,
    deferred: card.deferred,
    verdict: card.verdict,
    hardLines: card.hardLines,
    needsModel: compactionRoute({ chars, uncovered: prose }) !== "local",
    route: compactionRoute({ chars, uncovered: prose }),
    uncovered: prose,
    text: [
      card.text,
      `Shadowed characters: ${chars}. Regex kept lines: ${kept.length}. Omitted over budget: ${omitted}.`,
      "Short user messages:",
      ...(shortUsers.length === 0 ? ["- (none)"] : shortUsers.map((line) => `- ${line}`)),
    ].join("\n"),
  };
}
