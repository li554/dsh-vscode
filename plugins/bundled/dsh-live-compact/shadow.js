/**
 * 备份文件。按会话分目录，默认上限 256MB，快满时删最老的。
 * Shadow files live in per-session directories. Default cap is 256MB; delete the oldest when nearly full.
 *
 * 删除顺序：根目录旧文件，死会话，当前会话的旧文件。
 * 不删当前卡片指向的文件，也不删别的还活着的会话。ENOENT 当成已经删掉。
 * Delete legacy root files, then dead sessions, then old files of the current session.
 * Never delete the current card's file or another live session. ENOENT counts as already freed.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { performance } from "node:perf_hooks";
import {
  chmodSync,
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, win32 } from "node:path";

const DRIVE_ROOT = /^[A-Za-z]:[\\/]/;
const PLUGIN_NAME = /^(?:(?:cut|official|shadow)-\d+-[0-9a-f]{8}|raw-[0-9a-f]{16}|\d+-[0-9a-f]{8}-[0-9a-f]{8}|\d+-[0-9a-f]{8,16})\.txt$/;
let cachedSid = "";
const lockedDirs = new Map();
const lockedFiles = new Map();
let shadowFuseState = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
const shadowWarnings = new Set();

// No shared byte ledger. A positively dead holder leaves an immutable fence:
// recovery enables the original shared scans, never ownership or an estimate.
const ROTATION_LOCK = ".spine-rotation.lock";
const ROTATION_OWNER = ".spine-rotation.owner";
const ROTATION_SHARED = ".spine-rotation.shared";
const ROTATION_RECOVERED = ".spine-rotation.recovered";
const USAGE_MAX_AGE_MS = 60_000;
const rotationOwner = randomBytes(24).toString("hex");
let rotationScope = null;
let shadowUsage = null;

export function shadowDirectory(env = process.env) {
  return env.SPINE_SHADOW_DIR || defaultShadowDirectory(env);
}

function defaultShadowDirectory(env = process.env) {
  return join(env.DSH_HOME || join(homedir(), ".dsh"), "compaction-spine", "shadow");
}

function realDirectory(dir) {
  return realpathSync.native(dir);
}

function directoryIdentity(dir) {
  const info = statSync(dir, { bigint: true });
  if (!info.isDirectory() || info.ino <= 0n) return "";
  return `${info.dev}:${info.ino}`;
}

function coordinationError(cause) {
  const error = new Error("spine: shadow rotation coordination unavailable; backup refused", { cause });
  error.code = "ESHADOWBUSY";
  return error;
}

function touchExclusive(file, body = "") {
  let fd;
  try {
    fd = openSync(file, "wx", 0o600);
    writeFileSync(fd, body);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function readRotationOwner(file) {
  if (!lstatSync(file).isFile()) throw new Error("shadow owner is not a regular file");
  const fd = openSync(file, "r");
  try {
    const info = fstatSync(fd, { bigint: true });
    if (!info.isFile() || info.size <= 0n || info.size > 256n) throw new Error("invalid shadow owner size");
    const buffer = Buffer.alloc(257);
    const count = readSync(fd, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, count).toString("utf8");
    const record = JSON.parse(text);
    if (count !== Number(info.size) || record?.v !== 1 ||
        !Number.isSafeInteger(record.pid) || record.pid <= 0 || record.pid > 0x7fffffff ||
        !/^[0-9a-f]{48}$/.test(record.id) || `${JSON.stringify({ v: 1, pid: record.pid, id: record.id })}\n` !== text) {
      throw new Error("invalid shadow owner record");
    }
    return record;
  } finally {
    closeSync(fd);
  }
}

function rotationOwnerText(record) {
  return `${JSON.stringify({ v: 1, pid: record.pid, id: record.id })}\n`;
}

function publishRotationOwner(file, record) {
  const temp = `${file}.${randomBytes(24).toString("hex")}.tmp`;
  let fd;
  try {
    fd = openSync(temp, "wx", 0o600);
    writeFileSync(fd, rotationOwnerText(record));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    // The rotation lock serializes owner claims. Remove only the stale owner
    // after its PID was proven dead, then publish the complete replacement.
    try { unlinkSync(file); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    renameSync(temp, file);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temp); } catch {}
  }
}

function ownerProcessAlive(record) {
  try {
    process.kill(record.pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function claimRotationOwner(file) {
  const next = { pid: process.pid, id: rotationOwner };
  let current;
  try {
    current = readRotationOwner(file);
  } catch (error) {
    if (error?.code !== "ENOENT") return false;
  }
  if (current) {
    if (current.pid === next.pid && current.id === next.id) return true;
    if (ownerProcessAlive(current)) return false;
  }
  try {
    publishRotationOwner(file, next);
    return readRotationOwner(file).pid === next.pid && readRotationOwner(file).id === next.id;
  } catch {
    return false;
  }
}

function rotationRecordText(record) {
  return `${JSON.stringify({ v: 1, pid: record.pid, id: record.id })}\n`;
}

function readRotationRecord(file) {
  // Reject directories (including old empty locks), symlinks and special files
  // before opening. Neither malformed nor oversized metadata proves death.
  if (!lstatSync(file).isFile()) throw new Error("shadow holder is not a regular file");
  const fd = openSync(file, "r");
  try {
    const info = fstatSync(fd, { bigint: true });
    if (!info.isFile() || info.size <= 0n || info.size > 256n) throw new Error("invalid shadow holder size");
    const buffer = Buffer.alloc(257);
    const count = readSync(fd, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, count).toString("utf8");
    const record = JSON.parse(text);
    if (count !== Number(info.size) || record?.v !== 1 ||
        !Number.isSafeInteger(record.pid) || record.pid <= 0 || record.pid > 0x7fffffff ||
        !/^[0-9a-f]{48}$/.test(record.id) || rotationRecordText(record) !== text) {
      throw new Error("invalid shadow holder record");
    }
    return { ...record, identity: `${info.dev}:${info.ino}` };
  } finally {
    closeSync(fd);
  }
}

function sameRotationRecord(left, right) {
  return left.pid === right.pid && left.id === right.id;
}

function publishRotationRecord(file, record) {
  const temp = `${file}.${randomBytes(24).toString("hex")}.tmp`;
  let fd;
  let created = false;
  try {
    fd = openSync(temp, "wx", 0o600);
    created = true;
    writeFileSync(fd, rotationRecordText(record));
    fsyncSync(fd);
    const info = fstatSync(fd, { bigint: true });
    const published = { ...record, identity: `${info.dev}:${info.ino}` };
    closeSync(fd);
    fd = undefined;
    // Same-directory hard links atomically publish a complete, closed file on
    // POSIX and Windows. Unlike rename, link never replaces an existing lock.
    try { linkSync(temp, file); } catch (cause) {
      // Only a failure of this operation proves that hardlink publication is
      // unsupported. Permission, I/O and other ambiguous errors stay closed.
      if (!["ENOTSUP", "EOPNOTSUPP", "ENOSYS"].includes(cause?.code)) throw cause;
      const error = new Error("shadow hardlink publication unsupported", { cause });
      error.code = "ESHADOWLINKUNSUPPORTED";
      throw error;
    }
    return published;
  } finally {
    if (fd !== undefined) closeSync(fd);
    // The temp is only an extra name. Cleanup must neither hide publication's
    // outcome nor discard the exact ownership handle of an already live lock.
    if (created) { try { unlinkSync(temp); } catch {} }
  }
}

function syncRotationDirectory(root) {
  // Node cannot open/flush directory handles on Windows. The marker files are
  // flushed there too; POSIX also flushes their directory entries.
  if (process.platform === "win32") return;
  const fd = openSync(root, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function persistRotationFence(root, name) {
  const file = join(root, name);
  const fd = openSync(file, "a", 0o600);
  let identity;
  try {
    const info = fstatSync(fd, { bigint: true });
    if (!info.isFile()) throw new Error("invalid shadow fence");
    identity = `${info.dev}:${info.ino}`;
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  syncRotationDirectory(root);
  return identity;
}

function persistRotationShared(root) {
  return persistRotationFence(root, ROTATION_SHARED);
}

function linklessRecoveryName(record) {
  // An empty file's name atomically records the complete proven-dead token;
  // unlike writing JSON via wx, a crash cannot expose a partial recovery record.
  return `${ROTATION_RECOVERED}-${record.pid}-${record.id}`;
}

function hasLinklessRecovery(root, record) {
  try {
    const info = lstatSync(join(root, linklessRecoveryName(record)));
    if (!info.isFile() || info.size !== 0) throw new Error("invalid shadow recovery fence");
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function verifyRotationGuard(root, identity, guard) {
  if (identity && directoryIdentity(root) !== identity) throw new Error("shadow directory identity changed");
  if (!guard.record) {
    const fence = lstatSync(join(root, ROTATION_SHARED), { bigint: true });
    if (!guard.sharedIdentity || !fence.isFile() || `${fence.dev}:${fence.ino}` !== guard.sharedIdentity) {
      throw new Error("shadow shared fence identity changed");
    }
    try { lstatSync(join(root, ROTATION_LOCK)); } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    throw new Error("shadow transaction appeared during shared fallback");
  }
  const current = readRotationRecord(join(root, ROTATION_LOCK));
  if (!sameRotationRecord(current, guard.record) || current.identity !== guard.record.identity) {
    throw new Error("shadow lock identity changed");
  }
}

function releaseRotationGuard(root, identity, guard) {
  verifyRotationGuard(root, identity, guard);
  if (guard.owned) unlinkSync(join(root, ROTATION_LOCK));
}

function acquireRotationGuard(root, identity) {
  const lock = join(root, ROTATION_LOCK);
  const record = { pid: process.pid, id: randomBytes(24).toString("hex") };
  let guard;
  try {
    const published = publishRotationRecord(lock, record);
    guard = { owned: true, record: published };
    verifyRotationGuard(root, identity, guard);
    return guard;
  } catch (error) {
    shadowUsage = null;
    if (guard) {
      // Publication succeeded, but acquisition never returned its ownership
      // handle. Retry validation before releasing only that exact root/object/
      // record; a replacement or an unreadable guard must remain untouched.
      try { releaseRotationGuard(root, identity, guard); } catch {}
      throw error;
    }
    if (error?.code === "ESHADOWLINKUNSUPPORTED") {
      // Fence out all future exclusive estimates BEFORE observing a possible
      // earlier transaction. An exclusive owner publishes its lock first, so
      // absence after this durable fence cannot hide an active exclusive scope.
      const sharedIdentity = persistRotationShared(root);
      let observed;
      try { observed = readRotationRecord(lock); } catch (failure) {
        if (failure?.code !== "ENOENT") throw failure;
        const guard = { owned: false, sharedIdentity };
        verifyRotationGuard(root, identity, guard);
        return guard;
      }
      return recoverRotationGuard(root, identity, { owned: false, record: observed });
    }
    try { touchExclusive(join(root, ROTATION_SHARED)); } catch {}
    if (error?.code !== "EEXIST") throw error;
  }

  return recoverRotationGuard(root, identity, { owned: false, record: readRotationRecord(lock) });
}

function recoverRotationGuard(root, identity, guard) {
  const recovered = join(root, ROTATION_RECOVERED);
  let recovery;
  try { recovery = readRotationRecord(recovered); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (recovery && !sameRotationRecord(recovery, guard.record)) throw new Error("shadow recovery identity changed");
  const knownDead = !!recovery || hasLinklessRecovery(root, guard.record);
  if (!knownDead) {
    let dead = false;
    try { process.kill(guard.record.pid, 0); } catch (error) { dead = error?.code === "ESRCH"; }
    if (!dead) throw new Error("shadow holder is live or its death is unknown");
  }
  // Persist shared participation BEFORE permitting any action or recording
  // recovery. A later reused PID cannot resurrect this exact proven-dead token.
  persistRotationShared(root);
  verifyRotationGuard(root, identity, guard);
  if (!knownDead) {
    try { publishRotationRecord(recovered, guard.record); } catch (error) {
      if (error?.code === "ESHADOWLINKUNSUPPORTED") persistRotationFence(root, linklessRecoveryName(guard.record));
      else if (error?.code !== "EEXIST" || !sameRotationRecord(readRotationRecord(recovered), guard.record)) throw error;
    }
    syncRotationDirectory(root);
  }
  verifyRotationGuard(root, identity, guard);
  return guard; // Never unlink or replace an observed lock, even after ESRCH.
}

function dedicatedRoot(root, identity) {
  if (!identity || process.env.SPINE_SHADOW_SINGLE_PROCESS !== "1" || !process.env.SPINE_SHADOW_DIR) return false;
  try {
    if (realDirectory(process.env.SPINE_SHADOW_DIR) !== root) return false;
    // Explicitly spelling the normal shared root is not a dedicated-root contract.
    let normal = resolve(defaultShadowDirectory());
    try { normal = realDirectory(normal); } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") return false;
    }
    return normal !== root;
  } catch {
    return false;
  }
}

// A root is explicit at production call sites. Standalone helpers can also find
// an already participating parent; custom callers must pass root when using a
// session directory outside their configured shadowDirectory().
export function shadowRootForDir(dir) {
  const configured = shadowDirectory();
  try {
    const root = realDirectory(configured);
    let path;
    try { path = realDirectory(dir); } catch {
      path = join(realDirectory(dirname(resolve(dir))), basename(dir));
    }
    if (path === root || dirname(path) === root) return configured;
  } catch {}
  if (existsSync(join(dirname(dir), ROTATION_OWNER)) || existsSync(join(dirname(dir), ROTATION_SHARED))) return dirname(dir);
  return dir;
}

function scopedFile(file, root) {
  const path = join(realDirectory(dirname(file)), basename(file));
  const dir = dirname(path);
  return dir === root || dirname(dir) === root ? path : null;
}

function verifyRotationScope() {
  try {
    verifyRotationGuard(rotationScope.root, rotationScope.identity, rotationScope.guard);
  } catch (error) {
    shadowUsage = null;
    throw coordinationError(error);
  }
}

function retireRotationScope() {
  shadowUsage = null;
  rotationScope.exclusive = false;
  touchExclusive(join(rotationScope.root, ROTATION_SHARED));
}

function rememberShadowParent(dir) {
  const identity = directoryIdentity(dir);
  const expected = rotationScope.parents.get(dir);
  if (expected !== undefined && expected !== identity) {
    retireRotationScope();
    throw coordinationError(new Error("shadow session directory identity changed"));
  }
  rotationScope.parents.set(dir, identity);
  if (!identity && rotationScope.exclusive) retireRotationScope();
  return identity;
}

// Synchronous and reentrant only within this module's current root transaction.
// Different module instances/workers have different random owner tokens and use
// the same filesystem lock, even when they share a PID or a path alias.
export function withShadowRoot(dir, action) {
  let root;
  try { root = realDirectory(dir); } catch (error) { throw coordinationError(error); }
  if (rotationScope) {
    if (rotationScope.root !== root) throw coordinationError(new Error("nested shadow roots"));
    verifyRotationScope();
    return action();
  }
  const shared = join(root, ROTATION_SHARED);
  let identity;
  let guard;
  try {
    identity = directoryIdentity(root);
    guard = acquireRotationGuard(root, identity);
  } catch (error) {
    shadowUsage = null;
    throw coordinationError(error);
  }
  try {
    verifyRotationGuard(root, identity, guard);
    const optedIn = guard.owned && dedicatedRoot(root, identity);
    const owner = join(root, ROTATION_OWNER);
    let token = "";
    let currentOwner;
    try { currentOwner = readRotationOwner(owner); } catch {}
    const ownsCurrent = currentOwner?.pid === process.pid && currentOwner?.id === rotationOwner;
    if (optedIn && !existsSync(shared) && !ownsCurrent) {
      shadowUsage = null;
      if (!claimRotationOwner(owner)) touchExclusive(shared);
    }
    if (existsSync(owner)) {
      try {
        const record = readRotationOwner(owner);
        token = record.pid === process.pid && record.id === rotationOwner ? record.id : "";
      } catch {}
      if (token !== rotationOwner || !optedIn) touchExclusive(shared);
    }
    const exclusive = optedIn && token === rotationOwner && !existsSync(shared);
    if (!exclusive || shadowUsage?.root !== root || shadowUsage?.identity !== identity) shadowUsage = null;
    rotationScope = { root, identity, guard, exclusive, parents: new Map() };
    return action();
  } finally {
    rotationScope = null;
    try {
      releaseRotationGuard(root, identity, guard);
    } catch (error) {
      shadowUsage = null;
      // A transient verification failure must not strand a live owned lock.
      // Retry only with the original handle and the same verification checks.
      if (guard.owned) { try { releaseRotationGuard(root, identity, guard); } catch {} }
      throw coordinationError(error);
    }
  }
}

export function resetShadowAccessState() {
  cachedSid = "";
  lockedDirs.clear();
  lockedFiles.clear();
  // Test/restart helper only: callers must have no in-flight workers. Keep the
  // same shared buffer so idle worker retirement never creates a new fuse domain.
  Atomics.store(shadowFuseState, 0, 0);
  shadowWarnings.clear();
}

export function shadowAccessFused() {
  return Atomics.load(shadowFuseState, 0) !== 0;
}

export function shadowAccessFuseBuffer() {
  return shadowFuseState.buffer;
}

export function attachShadowAccessFuse(buffer) {
  if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength !== Int32Array.BYTES_PER_ELEMENT) {
    throw new TypeError("spine: invalid shared shadow access fuse");
  }
  const alreadyFused = shadowAccessFused();
  shadowFuseState = new Int32Array(buffer);
  if (alreadyFused) Atomics.store(shadowFuseState, 0, 1);
}

function tripFuse() {
  Atomics.store(shadowFuseState, 0, 1);
}

function envValue(env, name) {
  if (!env) return "";
  const found = Object.keys(env).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? String(env[found] ?? "").trim() : "";
}

export function windowsSystemRoot(env = process.env) {
  const systemRoot = envValue(env, "SystemRoot");
  const windir = envValue(env, "windir");
  const root = (DRIVE_ROOT.test(systemRoot) ? systemRoot : "") || (DRIVE_ROOT.test(windir) ? windir : "");
  return root.replace(/[\\/]+$/, "");
}

export function win32Tool(name, env = process.env) {
  const root = windowsSystemRoot(env);
  if (!root) {
    const error = new Error("spine: Windows system root is not a drive path");
    error.code = "ESHADOWACCESS";
    throw error;
  }
  return win32.join(root, "System32", name);
}

function accessIdentity(info) {
  if (info.ino <= 0n) return "";
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

function accessEntry(path, kind) {
  const absolute = resolve(path);
  // Directory aliases are supported, but cached aliases must keep pointing to
  // the same object. Never follow a final file symlink or chmod a hard link.
  const canonical = kind === "dir" ? realDirectory(absolute) : join(realDirectory(dirname(absolute)), basename(absolute));
  const info = lstatSync(canonical, { bigint: true });
  if (kind === "dir" ? !info.isDirectory() : !info.isFile() || info.nlink !== 1n) {
    throw new Error("spine: unsupported shadow permission target");
  }
  return { absolute, canonical, identity: accessIdentity(info) };
}

function sameAccessEntry(left, right) {
  return left.canonical === right.canonical && left.identity && left.identity === right.identity;
}

function lockedDirectory(entry) {
  const previous = lockedDirs.get(entry.absolute) ?? lockedDirs.get(entry.canonical);
  if (!previous) return false;
  if (!sameAccessEntry(previous, entry)) throw new Error("spine: shadow permission directory identity changed");
  lockedDirs.set(entry.absolute, previous);
  return true;
}

export function shadowDirLocked(path) {
  return lockedDirectory(accessEntry(path, "dir"));
}

export function noteShadowWarning(logger, error) {
  const code = error?.code || "ESHADOWACCESS";
  if (shadowWarnings.has(code)) return;
  shadowWarnings.add(code);
  const status = error?.cause?.status ?? error?.status;
  const step = error?.step || error?.cause?.step || "";
  const where = step ? ` ${step}` : "";
  const exit = status == null ? "" : ` exit ${status}`;
  logger?.warn?.(`spine: shadow permission failed ${code}${where}${exit}`);
}
const SESSION_MARK = /^# spine-session (\S+)/;

export function isPluginShadowName(name) {
  return PLUGIN_NAME.test(name);
}

export function sanitizeSessionKey(key) {
  const safe = String(key || "default").replace(/[^A-Za-z0-9_-]/g, "");
  return safe || "default";
}

export function sessionDir(root, key) {
  return join(root, sanitizeSessionKey(key));
}

function ownerPid(dir) {
  try {
    const text = readFileSync(join(dir, "owner"), "utf8").trim();
    const pid = Number(text);
    return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(pid) ? pid : null;
  } catch (error) {
    return error?.code === "ENOENT" ? 0 : null;
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

export function shadowFileBody(sessionKey, body) {
  const key = String(sessionKey || "default").replace(/\s+/g, "");
  return `# spine-session ${key}\n${body || ""}`;
}

export const STATS_NAME = "spine-stats.json";
export const CUTS_NAME = "spine-cuts.jsonl";

export function readCutStats(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, STATS_NAME), "utf8"));
    return {
      cuts: Number(parsed.cuts) || 0,
      savedTokens: Number(parsed.savedTokens) || 0,
      rewriteTokens: Number(parsed.rewriteTokens) || 0,
      drains: Number(parsed.drains) || 0,
    };
  } catch {
    return { cuts: 0, savedTokens: 0, rewriteTokens: 0, drains: 0 };
  }
}

export function drainRewrite(notes) {
  const cuts = (notes || []).filter((note) => note?.kind === "cut" && note.saved > 0);
  if (!cuts.length) return 0;
  const later = cuts.slice(1).reduce((sum, note) => sum + (note.saved || 0), 0);
  return Math.max(0, (cuts[0].afterPrefix || 0) - later);
}

export function flushDrainStats(dir, notes, meta = {}) {
  const cuts = (notes || []).filter((note) => note?.kind === "cut" && note.saved > 0);
  const charged = drainRewrite(notes);
  const saved = cuts.reduce((sum, note) => sum + note.saved, 0);
  if (cuts.length) recordDrainStats(dir, { cuts: cuts.length, saved, rewrite: charged });
  const lines = (notes || []).map((note, index) => JSON.stringify({
    v: 1,
    ts: new Date().toISOString(),
    sid: meta.sid || "",
    kind: note.kind || "cut",
    pass: index,
    drain: meta.drain === true,
    saved: note.saved || 0,
    rewriteCharged: note.kind === "cut" && index === (notes || []).findIndex((item) => item?.kind === "cut") ? charged : 0,
    tailBeyondKept: note.tailBeyondKept || 0,
    prefix: note.prefix || 0,
    afterPrefix: note.afterPrefix || 0,
    tokens: note.tokens || 0,
    total: note.total || 0,
    gate: note.gate || "cut",
  }));
  if (!lines.length) return charged;
  try {
    appendFileSync(join(dir, CUTS_NAME), `${lines.join("\n")}\n`);
  } catch {}
  return charged;
}

function recordDrainStats(dir, { cuts = 0, saved = 0, rewrite = 0 } = {}) {
  if (!(cuts > 0) || !(saved > 0)) return null;
  try {
    const file = join(dir, STATS_NAME);
    const lock = join(dir, "spine-stats.lock");
    const tmp = `${file}.${process.pid}-${randomBytes(8).toString("hex")}.tmp`;
    let fd;
    try {
      fd = openSync(lock, "wx");
    } catch {
      return null;
    }
    try {
      const prev = readCutStats(dir);
      const locked = {
        cuts: prev.cuts + cuts,
        savedTokens: prev.savedTokens + saved,
        rewriteTokens: prev.rewriteTokens + rewrite,
        drains: (Number(prev.drains) || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(tmp, JSON.stringify(locked));
      renameSync(tmp, file);
      return locked;
    } finally {
      try { unlinkSync(tmp); } catch {}
      closeSync(fd);
      try { unlinkSync(lock); } catch {}
    }
  } catch {
    return null;
  }
}

export function recordCutStats(dir, { saved = 0, rewrite = 0 } = {}) {
  if (!(saved > 0)) return readCutStats(dir);
  try {
    const file = join(dir, STATS_NAME);
    const lock = join(dir, "spine-stats.lock");
    const tmp = `${file}.${process.pid}-${randomBytes(8).toString("hex")}.tmp`;
    let fd;
    try {
      fd = openSync(lock, "wx");
    } catch {
      return null;
    }
    try {
      const prev = readCutStats(dir);
      const locked = {
        cuts: prev.cuts + 1,
        savedTokens: prev.savedTokens + saved,
        rewriteTokens: prev.rewriteTokens + rewrite,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(tmp, JSON.stringify(locked));
      renameSync(tmp, file);
      return locked;
    } finally {
      try { unlinkSync(tmp); } catch {}
      closeSync(fd);
      try { unlinkSync(lock); } catch {}
    }
  } catch {
    return null;
  }
}

function validWindowsSid(sid) {
  if (typeof sid !== "string" || sid.length > 184 || sid.trim() !== sid ||
      !/^S-1-(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*)){1,15}$/.test(sid)) return false;
  const numbers = sid.slice(4).split("-").map(BigInt);
  return numbers[0] <= 0xffffffffffffn && numbers.slice(1).every((number) => number <= 0xffffffffn);
}

// Fixed code only: path/SID/kind are process environment DATA, never PowerShell
// source or command-line fragments. Full .NET Framework is supplied by the fixed
// System32 WindowsPowerShell v1.0 executable (Windows PowerShell 5.1).
const WINDOWS_ACL_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $path = [Environment]::GetEnvironmentVariable('DSH_SHADOW_ACL_PATH', 'Process')
  $kind = [Environment]::GetEnvironmentVariable('DSH_SHADOW_ACL_KIND', 'Process')
  $sidText = [Environment]::GetEnvironmentVariable('DSH_SHADOW_ACL_SID', 'Process')
  if ([String]::IsNullOrEmpty($path) -or ($kind -ne 'dir' -and $kind -ne 'file')) { throw 'Invalid target' }
  $userSid = [Security.Principal.SecurityIdentifier]::new($sidText)
  if ($userSid.Value -cne $sidText -or [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $sidText) { throw 'Invalid identity' }
  $attributes = [IO.File]::GetAttributes($path)
  if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse target' }
  if ((($attributes -band [IO.FileAttributes]::Directory) -ne 0) -ne ($kind -eq 'dir')) { throw 'Wrong target kind' }
  $sids = @($sidText, 'S-1-5-18', 'S-1-5-32-544')
  $expected = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $inheritance = [Security.AccessControl.InheritanceFlags]::None
  if ($kind -eq 'dir') {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
  } else {
    $acl = [Security.AccessControl.FileSecurity]::new()
  }
  # A NEW descriptor, not GetAccessControl + grant replacement: no old explicit
  # grant or deny can survive. Only Access is modified; owner/group/SACL are not.
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in $sids) {
    if ($expected.Add($sid)) {
      $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        [Security.Principal.SecurityIdentifier]::new($sid),
        [Security.AccessControl.FileSystemRights]::FullControl,
        $inheritance, [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow)
      $acl.AddAccessRule($rule)
    }
  }
  if ($kind -eq 'dir') {
    [IO.Directory]::SetAccessControl($path, $acl)
    $actual = [IO.Directory]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
  } else {
    [IO.File]::SetAccessControl($path, $acl)
    $actual = [IO.File]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
  }
  if (!$actual.AreAccessRulesProtected -or !$actual.AreAccessRulesCanonical) { throw 'Unprotected DACL' }
  $rules = $actual.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  if ($rules.Count -ne $expected.Count) { throw 'Unexpected ACE count' }
  foreach ($rule in $rules) {
    if (!$expected.Remove($rule.IdentityReference.Value) -or $rule.IsInherited -or
        $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
        $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or
        $rule.InheritanceFlags -ne $inheritance -or
        $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None) { throw 'Unexpected ACE' }
  }
  if ($expected.Count -ne 0) { throw 'Missing ACE' }
  [Console]::Out.Write('DSH_SHADOW_ACL_OK')
  exit 0
} catch {
  # Never echo paths, identity output, or exception data into host logs.
  exit 1
}
`;
const WINDOWS_ACL_COMMAND = Buffer.from(WINDOWS_ACL_SCRIPT, "utf16le").toString("base64");

export function shadowAccessPlan(platform = process.platform, userSid = "", kind = "dir") {
  if (platform === "win32") {
    if (!validWindowsSid(userSid)) {
      throw new Error("spine: current Windows user SID is required");
    }
    if (kind !== "dir" && kind !== "file") throw new Error("spine: invalid shadow permission kind");

    return {
      kind: "acl",
      usesChmodOnly: false,
      replace: true,
      protected: true,
      inheritance: kind === "dir" ? ["ObjectInherit", "ContainerInherit"] : [],
      allow: [...new Set([userSid, "S-1-5-18", "S-1-5-32-544"])],
      rights: "FullControl",
    };
  }

  return {
    kind: "mode",
    usesChmodOnly: true,
    dirMode: 0o700,
    fileMode: 0o600,
  };
}

export function defaultShadowAccessRunner({
  path,
  kind,
  platform,
  execFile = execFileSync,
  env = process.env,
} = {}) {
  if (platform !== "win32") {
    const plan = shadowAccessPlan(platform);
    chmodSync(path, kind === "dir" ? plan.dirMode : plan.fileMode);
    return true;
  }

  if (shadowAccessFused()) {
    const error = new Error("spine: shadow permission already failed");
    error.code = "ESHADOWACCESS";
    throw error;
  }

  let whoamiPath = "";
  let powershellPath = "";
  try {
    whoamiPath = win32Tool("whoami.exe", env);
    powershellPath = win32Tool("WindowsPowerShell\\v1.0\\powershell.exe", env);
  } catch (error) {
    tripFuse();
    throw error;
  }

  let sid = cachedSid;
  if (!sid) {
    let identity = "";
    try {
      identity = execFile(whoamiPath, ["/user", "/fo", "csv", "/nh"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 65536,
      });
    } catch (error) {
      error.step = "whoami";
      tripFuse();
      throw error;
    }
    const match = String(identity ?? "").match(/^"(?:[^"\r\n]|"")*","(S-1-[\d-]+)"\s*$/);
    if (!match || !validWindowsSid(match[1])) {
      const error = new Error("spine: cannot determine current Windows user SID");
      error.step = "whoami";
      tripFuse();
      throw error;
    }
    sid = match[1];
    cachedSid = sid;
  }

  try {
    shadowAccessPlan("win32", sid, kind);
    const before = accessEntry(path, kind);
    // Also guard direct runner callers, including legacy files through aliases.
    lockedDirectory(kind === "dir" ? before : accessEntry(dirname(path), "dir"));
    const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
      !/^DSH_SHADOW_ACL_(PATH|KIND|SID)$/i.test(key)));
    Object.assign(childEnv, {
      DSH_SHADOW_ACL_PATH: before.canonical,
      DSH_SHADOW_ACL_KIND: kind,
      DSH_SHADOW_ACL_SID: sid,
    });
    const result = execFile(
      powershellPath,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", WINDOWS_ACL_COMMAND],
      { env: childEnv, encoding: "utf8", stdio: "pipe", windowsHide: true, timeout: 15000, maxBuffer: 65536 },
    );
    if (String(result).trim() !== "DSH_SHADOW_ACL_OK") throw new Error("spine: shadow DACL verification not confirmed");
    const after = accessEntry(path, kind);
    if (!sameAccessEntry(before, after)) throw new Error("spine: shadow permission target identity changed");
    if (kind === "dir") {
      lockedDirs.set(after.absolute, after);
      lockedDirs.set(after.canonical, after);
    } else {
      lockedFiles.set(after.canonical, after);
    }
  } catch (error) {
    error.step = kind === "file" ? "file" : "dir";
    tripFuse();
    throw error;
  }

  return true;
}

export function tightenShadow(path, kind = "dir", access = {}) {
  const platform = access.platform ?? process.platform;
  const windows = platform === "win32" && !access.runner;
  if (windows && shadowAccessFused()) {
    const error = new Error("spine: shadow permission action failed; backup refused");
    error.code = "ESHADOWACCESS";
    throw error;
  }

  const runner = access.runner ?? ((action) => defaultShadowAccessRunner({
    ...action,
    execFile: access.execFile,
    env: access.env,
  }));

  try {
    if (windows) {
      if (kind === "dir" && shadowDirLocked(path)) return;
      if (kind === "file") {
        const parentLocked = shadowDirLocked(dirname(path));
        const current = accessEntry(path, kind);
        // A cached parent alone says nothing about an old file's explicit ACEs.
        const previous = lockedFiles.get(current.canonical);
        if (previous && sameAccessEntry(previous, current) && parentLocked) return;
      }
    }
    if (runner({ path, kind, platform, env: access.env, execFile: access.execFile }) !== true) {
      throw new Error("permission runner did not confirm success");
    }
  } catch (cause) {
    if (windows) tripFuse();
    const error = new Error(
      "spine: shadow permission action failed; backup refused",
      { cause },
    );
    error.code = "ESHADOWACCESS";
    error.step = cause?.step;
    throw error;
  }
}

export function ensureShadowDir(dir, access = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  tightenShadow(dir, "dir", access);
  return dir;
}

export function tightenCreatedShadow(file, fd, access, { remember = true, skipRunner = false } = {}) {
  if (skipRunner) {
    try {
      const entry = accessEntry(file);
      const opened = fstatSync(fd, { bigint: true });
      if (!entry.identity || entry.identity !== accessIdentity(opened) || opened.nlink !== 1n) {
        throw new Error("spine: shadow published file identity changed");
      }
      if (remember) lockedFiles.set(entry.canonical, entry);
      return;
    } catch (cause) {
      tripFuse();
      const error = new Error("spine: shadow permission action failed; backup refused", { cause });
      error.code = "ESHADOWACCESS";
      error.step = "file";
      throw error;
    }
  }
  if ((access.platform ?? process.platform) === "win32" && !access.runner && !shadowAccessFused()) {
    try {
      if (shadowDirLocked(dirname(file))) {
        const entry = accessEntry(file, "file");
        const opened = fstatSync(fd, { bigint: true });
        if (!entry.identity || entry.identity !== accessIdentity(opened) || opened.nlink !== 1n) {
          throw new Error("spine: shadow created file identity changed");
        }
        // Only this wx-created object is known to inherit our confirmed DACL.
        if (remember) lockedFiles.set(entry.canonical, entry);
        return;
      }
    } catch (cause) {
      tripFuse();
      const error = new Error("spine: shadow permission action failed; backup refused", { cause });
      error.code = "ESHADOWACCESS";
      error.step = "file";
      throw error;
    }
  }
  tightenShadow(file, "file", access);
}

export function discardShadowFiles(files, cause, unlink = unlinkSync) {
  const errors = [];

  for (const file of files) {
    if (rotationScope) {
      verifyRotationScope();
      const path = scopedFile(file, rotationScope.root);
      if (!path) throw coordinationError(new Error("cleanup outside shadow root"));
      rememberShadowParent(dirname(path));
    }
    try {
      unlink(file);
    } catch (error) {
      if (error?.code !== "ENOENT") errors.push(error);
    }
  }

  if (errors.length > 0) {
    const error = new AggregateError(
      [cause, ...errors],
      "spine: shadow write failed and cleanup failed",
    );
    error.code = cause?.code || "ESHADOWCLEANUP";
    throw error;
  }
}

export function writeShadowFile(
  file,
  body,
  access = {},
  { exclusive = false, root, write = writeFileSync, unlink = unlinkSync } = {},
) {
  const dir = dirname(file);
  ensureShadowDir(dir, access);
  return withShadowRoot(root ?? shadowRootForDir(dir), () => {
    const path = scopedFile(file, rotationScope.root);
    if (!path) throw coordinationError(new Error("shadow file outside root scope"));
    writeShadowFileLocked(path, body, access, { exclusive, write, unlink, accessPath: file });
    return file;
  });
}

function writeShadowFileLocked(file, body, access, { exclusive, write, unlink, accessPath }) {
  const dir = dirname(file);
  const parentIdentity = rememberShadowParent(dir);

  // Always stage the body in a private temporary file. Publishing the final
  // name only after the bytes are flushed prevents readers from observing a
  // half-written raw or meta file after a process interruption.
  const target = join(
    dir,
    `.${basename(file)}-${randomBytes(8).toString("hex")}.tmp`,
  );

  let fd = null;
  let created = false;
  let protectedPath = target;

  try {
    fd = openSync(target, "wx", 0o600);
    created = true;

    verifyRotationScope();
    if (parentIdentity && directoryIdentity(dir) !== parentIdentity) {
      retireRotationScope();
      throw coordinationError(new Error("shadow session directory identity changed"));
    }
    // Confirm ACL/mode before any secret bytes are written to the staged file.
    tightenCreatedShadow(target, fd, access);
    // Full replacement bytes are a conservative charge, even for overwrites,
    // partial writes and failed cleanup. Metadata/owner/stats are not capacity.
    if (shadowUsage && isPluginShadowName(basename(file))) {
      shadowUsage.bytes += typeof body === "string" ? Buffer.byteLength(body, "utf8") : body.byteLength;
    }
    write(fd, body);
    fsyncSync(fd);

    // The rotation/root lock provides the no-overwrite boundary for exclusive
    // raw files. Refuse a file that appeared after admission; never replace it.
    if (exclusive && existsSync(file)) {
      const error = new Error("shadow file already exists");
      error.code = "EEXIST";
      throw error;
    }
    renameSync(target, file);
    protectedPath = file;

    // Keep the caller's spelling for the permission cache/runner. The opened
    // descriptor and the final path now refer to the same published object.
    tightenCreatedShadow(file, fd, access, { skipRunner: true });

    const opened = fd;
    fd = null;
    closeSync(opened);
    return file;
  } catch (error) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {}
    }

    if (created) {
      // Do not unlink through a replacement directory after a failed write.
      let sameParent = false;
      try { sameParent = !parentIdentity || directoryIdentity(dir) === parentIdentity; } catch {}
      if (sameParent) discardShadowFiles([protectedPath], error, unlink);
      else shadowUsage = null;
    }
    throw error;
  }
}

export function writeShadowOwner(dir, access = {}, root) {
  return writeShadowFile(
    join(dir, "owner"),
    String(process.pid),
    access,
    { root },
  );
}

export function shadowMaxBytes(env = process.env) {
  const bytes = Number(env.SPINE_SHADOW_MAX_BYTES);
  if (Number.isFinite(bytes) && bytes > 0) return Math.floor(bytes);
  const mb = Number(env.SPINE_SHADOW_MAX_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
  return 256 * 1024 * 1024;
}

function readSessionKey(file) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(240);
    const count = readSync(fd, buf, 0, buf.length, 0);
    const line = buf.subarray(0, count).toString("utf8").split("\n")[0] || "";
    return SESSION_MARK.exec(line)?.[1] || "";
  } catch {
    return "";
  } finally {
    closeSync(fd);
  }
}

export function listPluginShadows(dir, {
  readdir = readdirSync,
  stat = statSync,
  onError,
  includeSessionKey = true,
} = {}) {
  let names = [];
  try {
    names = readdir(dir);
  } catch {
    onError?.();
    return [];
  }
  const files = [];
  for (const name of names) {
    if (!isPluginShadowName(name)) continue;
    const path = resolve(dir, name);
    try {
      const info = stat(path);
      if (!info.isFile()) continue;
      files.push({
        name,
        path,
        size: info.size,
        mtimeMs: info.mtimeMs,
        sessionKey: includeSessionKey ? readSessionKey(path) : "",
      });
    } catch { onError?.(); }
  }
  return files;
}

function byAge(left, right) {
  return left.mtimeMs - right.mtimeMs || left.name.localeCompare(right.name);
}

export function listShadowEntries(dir, alive = processAlive, {
  readdir = readdirSync,
  stat = statSync,
  onError,
  includeSessionKey = false,
} = {}) {
  const entries = [];
  let names = [];
  try {
    names = readdir(dir, { withFileTypes: true });
  } catch {
    onError?.();
    return entries;
  }
  for (const entry of names) {
    if (entry.name === ROTATION_LOCK) continue;
    const path = resolve(dir, entry.name);
    if (entry.isFile() && isPluginShadowName(entry.name)) {
      try {
        const info = stat(path);
        entries.push({
          name: entry.name,
          path,
          size: info.size,
          mtimeMs: info.mtimeMs,
          sessionKey: "",
          legacy: true,
          live: false,
        });
      } catch { onError?.(); }
      continue;
    }
    if (!entry.isDirectory()) continue;
    const owner = ownerPid(path);
    let live = owner === null;
    if (owner > 0) {
      try { live = alive(owner) !== false; } catch { live = true; }
    }
    for (const file of listPluginShadows(path, { readdir, stat, onError, includeSessionKey })) {
      // The directory and its owner define deletion authority. Raw tool output
      // is untrusted data and may itself start with a spine-session marker.
      entries.push({ ...file, legacy: false, live, sessionKey: entry.name });
    }
  }
  return entries;
}

// 先删根目录旧文件，再删死会话，最后才删当前会话的旧文件。
// 当前卡片和这次引用的原文路径受保护。删不掉且仍然超限时返回 ok:false。
// Delete legacy root files, then dead sessions, then old files of this session.
// Protect the current card and cited raw paths. If unlink fails and the cap is still exceeded, ok is false.
export function rotateShadow(options) {
  return withShadowRoot(options.dir, () => rotateShadowLocked(options));
}

// Complete backup transaction used by both the synchronous compatibility API
// and the optional root-writer worker. The rotation lock stays held from the
// full reconcile through ACL-protected body publication; callers must not move
// only the scan to a worker and release the lock before the write.
export function saveShadowTransaction({
  shadow,
  file,
  body,
  required = false,
  protectPaths = [],
  sessionKey = "default",
  cap,
  access = {},
  rotationIO = {},
} = {}) {
  ensureShadowDir(shadow, access);
  const dir = sessionDir(shadow, sessionKey);
  ensureShadowDir(dir, access);
  return withShadowRoot(shadow, () => {
    const owner = join(dir, "owner");
    const ownerExisted = existsSync(owner);
    let ownerWritten = false;
    try {
      writeShadowOwner(dir, access, shadow);
      ownerWritten = true;
      const incoming = Buffer.byteLength(body);
      const rotation = rotateShadow({
        ...rotationIO,
        dir: shadow,
        incomingBytes: incoming,
        protectPath: file,
        protectPaths,
        sessionKey,
        cap,
      });
      if (!rotation.ok) {
        if (rotation.reason) {
          const incomplete = rotation.reason === "scan-incomplete";
          const error = Object.assign(new Error(incomplete
            ? "spine: shadow capacity scan is incomplete; backup refused; leaving the span"
            : "spine: shadow capacity measurement is invalid; backup refused; leaving the span"), {
            code: incomplete ? "ESHADOWSCAN" : "ESHADOWMETER",
          });
          if (required) throw error;
          return { ok: false, skipped: true, reason: rotation.reason, rotation };
        }
        if (required) throw new Error("spine: shadow backup is full; leaving the span");
        return { ok: false, skipped: true, reason: "full", rotation };
      }
      writeShadowFile(file, body, access, { root: shadow });
      if (!existsSync(file)) throw new Error("spine: shadow backup was not written");
      return { ok: true, file, rotation };
    } catch (error) {
      if (ownerWritten && !ownerExisted) discardShadowFiles([owner], error);
      throw error;
    }
  });
}

function rotationTime(now) {
  try {
    const value = now();
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function rotateShadowLocked({
  incomingBytes, protectPath, protectPaths = [], sessionKey, cap,
  unlink = unlinkSync, alive = processAlive, readdir = readdirSync, stat = statSync,
  now = () => performance.now(),
}) {
  const { root, identity, exclusive } = rotationScope;
  const low = Math.floor(cap * 0.8);
  const oversize = incomingBytes > cap;
  const cached = shadowUsage;
  const observed = exclusive ? rotationTime(now) : null;
  const validTime = observed !== null && (!cached || observed >= cached.lastObservedAt);
  if (exclusive && cached?.cap === cap && validTime && observed >= cached.calibratedAt &&
      observed - cached.calibratedAt < USAGE_MAX_AGE_MS && Number.isSafeInteger(cached.bytes) &&
      Number.isSafeInteger(incomingBytes) && incomingBytes >= 0 && !oversize && cached.bytes + incomingBytes < low) {
    cached.lastObservedAt = observed;
    return { ok: true, deleted: 0, freed: 0, used: cached.bytes, cap, oversize: false, failed: false, estimated: true };
  }
  shadowUsage = null;
  let complete = true;
  const files = listShadowEntries(root, alive, { readdir, stat, onError() { complete = false; } });
  const protect = new Set([protectPath, ...protectPaths].filter(Boolean).map((path) => {
    try { return join(realDirectory(dirname(path)), basename(path)); } catch { return resolve(path); }
  }));
  const current = sanitizeSessionKey(sessionKey);
  let used = files.reduce((sum, file) => sum + file.size, 0);
  const validBytes = [used, incomingBytes, cap].every(Number.isSafeInteger) && used >= 0 && incomingBytes >= 0 && cap > 0;
  // Missing entries make used a lower bound, never evidence of free space.
  // Refuse before deletion as well: a partial scan cannot establish a safe
  // rotation, even when the incoming backup qualifies for the oversize rule.
  if (!complete) {
    return { ok: false, deleted: 0, freed: 0, used, cap, oversize, failed: true, reason: "scan-incomplete" };
  }
  if (!validBytes) {
    return { ok: false, deleted: 0, freed: 0, used, cap, oversize, failed: true, reason: "invalid-measurement" };
  }
  const publishUsage = () => {
    if (!exclusive || !validTime) return;
    const completed = rotationTime(now);
    if (completed === null || completed < observed) return;
    shadowUsage = { root, identity, cap, bytes: used, calibratedAt: completed, lastObservedAt: completed };
  };
  if (!oversize && used + incomingBytes <= cap) {
    publishUsage();
    return { ok: true, deleted: 0, freed: 0, used, cap, oversize: false, failed: false };
  }
  const legacy = [];
  const dead = [];
  const mine = [];
  for (const file of files) {
    if (protect.has(file.path)) continue;
    if (file.live && file.sessionKey !== current) continue;
    if (file.legacy) legacy.push(file);
    else if (file.sessionKey === current) mine.push(file);
    else dead.push(file);
  }
  legacy.sort(byAge);
  dead.sort(byAge);
  mine.sort(byAge);
  let deleted = 0;
  let freed = 0;
  let failed = false;
  for (const file of [...legacy, ...dead, ...mine]) {
    if (!oversize && used + incomingBytes <= low) break;
    try {
      unlink(file.path);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        failed = true;
        break;
      }
    }
    used -= file.size;
    freed += file.size;
    deleted += 1;
    if (file.name.startsWith("raw-")) {
      try {
        unlink(`${file.path}.meta.json`);
      } catch {}
    }
  }
  const fits = used + incomingBytes <= cap;
  const ok = !failed && (oversize || fits);
  if (ok) publishUsage();
  return {
    ok,
    deleted,
    freed,
    used,
    cap,
    oversize,
    failed,
  };
}
