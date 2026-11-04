// White-box verification for the compaction-shadowed rewind fix in
// dsh-rewind-plugin/lib/index.js. Extracts the REAL planRewind +
// isHumanUserMessageEvent function bodies out of the shipped bundle (so the
// test can never drift from what actually runs), then drives them with
// synthetic event logs / surfaces:
//   1. plain target on the surface  -> normal plan (regression)
//   2. target folded out by a compaction summary node -> plan drops the
//      covering node and everything after it (the fix)
//   3. target absent from log entirely -> still throws not-on-surface
import fs from "node:fs";
import path from "node:path";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");
const SRC = path.join(PROJ, "plugins", "bundled", "dsh-rewind-plugin", "lib", "index.js");
const src = fs.readFileSync(SRC, "utf8");

function extract(fnName) {
  const m = new RegExp(`function ${fnName}\\([\\s\\S]*?\\n\\}`, "m").exec(src);
  if (!m) throw new Error(`function ${fnName} not found in ${SRC}`);
  return m[0];
}

class RewindError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const planRewind = new Function(
  "RewindError",
  "listRewindCandidates",
  `"use strict";
${extract("isUserMessageEvent")}
${extract("isHumanUserMessageEvent")}
${extract("planRewind")}
return planRewind;
`)(RewindError, () => {
  throw new Error("listRewindCandidates must not be called in seq mode");
});

const human = (seq, text) => ({
  seq,
  type: "user/message",
  time: seq * 1000,
  data: { source: { kind: "user" }, content: [{ type: "text", text }] }
});
const summary = (seq, start, end, shadowed) => ({
  seq,
  type: "user/message",
  time: seq * 1000,
  surfaceOp: { op: "replace", startSeq: start, endSeq: end },
  sourceEventSeqs: shadowed,
  data: { source: { kind: "compaction" }, content: [{ type: "text", text: "[compacted]" }] }
});
const system = (seq) => ({ seq, type: "system/message", time: seq * 1000, data: {} });

let pass = 0, checks = 0;
function ok(label, cond) {
  checks++;
  if (cond) pass++;
  console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`);
}

// 1. plain target on the surface — unchanged behavior
{
  const events = [system(100), human(200, "hello"), human(250, "second")];
  const surface = [100, 200, 250];
  const plan = planRewind(events, surface, { kind: "seq", seq: 200 });
  ok("plain target: targetSeq", plan.targetSeq === 200);
  ok("plain target: targetIndex", plan.targetIndex === 1);
  ok("plain target: shadowedSeqs", JSON.stringify(plan.shadowedSeqs) === JSON.stringify([200, 250]));
  ok("plain target: surfaceStart/End", plan.surfaceStart === 200 && plan.surfaceEnd === 250);
}

// 2. target shadowed by a compaction summary node — the fix
{
  const events = [
    system(100),
    human(200, "old"),
    human(223, "the message to rewind to"),
    human(260, "later"),
    summary(301, 200, 260, [200, 223, 260]),
    human(302, "post-compaction user"),
    human(303, "post-compaction user 2")
  ];
  const surface = [100, 301, 302, 303];
  const plan = planRewind(events, surface, { kind: "seq", seq: 223 });
  ok("compaction-shadowed: targetSeq", plan.targetSeq === 223);
  ok("compaction-shadowed: targetIndex points at covering node", plan.targetIndex === 1);
  ok(
    "compaction-shadowed: shadowedSeqs drop summary + tail",
    JSON.stringify(plan.shadowedSeqs) === JSON.stringify([301, 302, 303])
  );
  ok("compaction-shadowed: surfaceStart/End", plan.surfaceStart === 301 && plan.surfaceEnd === 303);
}

// 3. target present in the log but neither on the surface nor covered by any
// replace node (cannot happen through the fold; exercises the fallback branch)
{
  const events = [system(100), human(200, "hello")];
  const surface = [100];
  let threw = null;
  try {
    planRewind(events, surface, { kind: "seq", seq: 200 });
  } catch (e) {
    threw = e;
  }
  ok("orphan target: throws not-on-surface", threw instanceof RewindError && threw.code === "not-on-surface");
}

// 4. target not in the log at all — unchanged not-a-user-message error
{
  const events = [system(100), human(200, "hello")];
  const surface = [100, 200];
  let threw = null;
  try {
    planRewind(events, surface, { kind: "seq", seq: 999 });
  } catch (e) {
    threw = e;
  }
  ok("absent target: throws not-a-user-message", threw instanceof RewindError && threw.code === "not-a-user-message");
}

console.log("RESULT: " + pass + "/" + checks + " checks passed");
process.exit(pass === checks ? 0 : 1);
