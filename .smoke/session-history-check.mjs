// Check whether a DSH_HOME's saved sessions can still be OBSERVED by this build.
//
// WHY. DSH 0.1.5 introduced versioned session formats with exact released-set
// validators, and the v0->v1 migration REFUSES a session carrying anything
// outside the released shape. Third-party plugins wrote into v0 sessions freely,
// so upgrading can make old history unopenable with a message that names an
// event and a member but not the plugin responsible:
//
//   failed to observe session "session-…":
//   @deepseek-ai/dsh-session-format-v0-to-v1 refuses this format v0 Session:
//   tool/result 29150 message content[0] content[1] has unexpected member
//   "dshFileReview"
//
// This runs the platform's own payload validator over every row of every session
// and reports exactly which sessions refuse and why — the diagnostic, and the
// regression check for .smoke/platform-patches/.
//
// Usage: node .smoke/session-history-check.mjs <DSH_HOME | sessions dir>
//
// NOTE ON DECODING: a `.jsonl.zstd` session log is APPEND-ONLY — every flush
// appends its own Zstandard frame, so the file is thousands of concatenated
// frames. Node's zstdDecompressSync (and createZstdDecompress) stop after the
// FIRST frame, which silently truncates a read to the session header alone. The
// frame walker below is therefore load-bearing, not an optimisation.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const VALIDATOR = path.join(ROOT, "vendor", "node_modules", "@deepseek-ai", "dsh-session-format-v0-to-v1", "lib", "index.js");

const ZSTD_MAGIC = 0xfd2fb528;
const SKIPPABLE_MAGIC = 0x184d2a50;

/** End offset of the Zstandard frame starting at `start`, or undefined if torn. */
function frameEnd(buffer, start) {
  let at = start + 4;
  if (at + 1 > buffer.length) return undefined;
  const descriptor = buffer[at];
  at += 1;
  if (!((descriptor >> 5) & 1)) at += 1;                 // window descriptor
  at += [0, 1, 2, 4][descriptor & 3];                    // dictionary id
  at += [0, 2, 4, 8][descriptor >> 6];                   // frame content size
  for (;;) {
    if (at + 3 > buffer.length) return undefined;
    const header = buffer.readUIntLE(at, 3);
    at += 3;
    const lastBlock = header & 1;
    const blockType = (header >> 1) & 3;
    const blockSize = header >> 3;
    if (blockType === 1) at += 1;                        // RLE
    else if (blockType === 0 || blockType === 2) at += blockSize;
    else return undefined;                               // reserved
    if (at > buffer.length) return undefined;
    if (lastBlock) break;
  }
  if ((descriptor >> 2) & 1) at += 4;                    // checksum
  return at;
}

/** Decode every frame of an append-only `.jsonl.zstd` session log. */
function decodeSessionLog(file) {
  const buffer = fs.readFileSync(file);
  const parts = [];
  let at = 0;
  while (at + 4 <= buffer.length) {
    const magic = buffer.readUInt32LE(at);
    if ((magic & 0xfffffff0) === SKIPPABLE_MAGIC) {
      if (at + 8 > buffer.length) break;
      at += 8 + buffer.readUInt32LE(at + 4);
      continue;
    }
    if (magic !== ZSTD_MAGIC) { at += 1; continue; }      // resync
    const end = frameEnd(buffer, at);
    if (end === undefined) break;
    try { parts.push(zlib.zstdDecompressSync(buffer.subarray(at, end))); } catch { /* torn tail */ }
    at = end;
  }
  return Buffer.concat(parts).toString("utf8");
}

/** Session dirs under a DSH_HOME (or a sessions dir passed directly). */
function sessionDirs(input) {
  const sessionsRoot = fs.existsSync(path.join(input, "sessions")) ? path.join(input, "sessions") : input;
  if (!fs.existsSync(sessionsRoot)) return [];
  const dirs = [];
  for (const bucket of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!bucket.isDirectory()) continue;
    const bucketPath = path.join(sessionsRoot, bucket.name);
    for (const entry of fs.readdirSync(bucketPath, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("session-")) dirs.push(path.join(bucketPath, entry.name));
    }
  }
  return dirs;
}

const input = process.argv[2];
if (!input) {
  console.log("usage: node .smoke/session-history-check.mjs <DSH_HOME | sessions dir>");
  process.exit(2);
}
if (!fs.existsSync(VALIDATOR)) {
  console.log(`cannot find the session-format validator at ${VALIDATOR}`);
  process.exit(2);
}

const { assertReleasedPayloadSemantics } = await import(pathToFileURL(VALIDATOR).href);
const dirs = sessionDirs(input);
console.log(`sessions found: ${dirs.length} under ${input}`);

let rowsValidated = 0, refused = 0;
const reasons = new Map();
const badSessions = [];

for (const dir of dirs) {
  const file = path.join(dir, "session.jsonl.zstd");
  if (!fs.existsSync(file)) continue;
  let text;
  try { text = decodeSessionLog(file); } catch (error) { badSessions.push({ id: path.basename(dir), refusals: 1, why: "undecodable: " + error.message }); continue; }
  let sessionRefused = 0;
  const why = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (typeof row?.type !== "string" || row.data === undefined) continue;
    try {
      assertReleasedPayloadSemantics({ type: row.type, seq: row.seq, data: row.data }, 0);
      rowsValidated++;
    } catch (error) {
      const message = error?.message ?? String(error);
      // Packed run row types (reasoning-chunks, text-chunks, …) are expanded by
      // the codec before the payload validator sees them; it says so explicitly.
      if (message.includes("released payload validator is missing event")) continue;
      refused++;
      sessionRefused++;
      const key = message.replace(/[0-9]+/g, "<n>").slice(0, 140);
      why.add(key);
      reasons.set(key, (reasons.get(key) || 0) + 1);
    }
  }
  if (sessionRefused) badSessions.push({ id: path.basename(dir), refusals: sessionRefused, why: [...why] });
}

console.log(`rows validated: ${rowsValidated}`);
console.log(`rows refused:   ${refused}\n`);
if (reasons.size) {
  console.log("refusal reasons (digits -> <n>):");
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  x${n}  ${r}`);
  console.log();
}
if (badSessions.length) {
  console.log(`sessions that will FAIL to load (${badSessions.length}):`);
  for (const s of badSessions) console.log(`  ${s.id}: ${s.refusals} event(s)\n     ${s.why.join("\n     ")}`);
} else {
  console.log("every session validates against the released v0 set");
}
console.log(`\nRESULT: ${refused === 0 ? "PASS" : "FAIL"}`);
process.exit(refused === 0 ? 0 : 1);
