import { createTwoFilesPatch } from 'diff';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
export const name = '@dsh-external/dsh-diff-review';
export const inject = [];
const TRACKED_TOOLS = new Set(['edit', 'write', 'str_replace_editor']);
/** sessionId -> turn -> filePath -> change */
const changesBySession = new Map();
const latestTurnBySession = new Map();
/** Persisted change log, keyed by session id. Survives plugin reloads. */
const STORAGE_DIR = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'diff-review', 'sessions');
function storagePath(sessionId) {
    return join(STORAGE_DIR, `${sessionId}.json`);
}
function persistSession(sessionId) {
    const turns = changesBySession.get(sessionId);
    if (turns === undefined)
        return;
    const payload = [...turns.entries()]
        .map(([turn, files]) => ({ turn, files: [...files.values()] }))
        .sort((a, b) => b.turn - a.turn);
    try {
        mkdirSync(STORAGE_DIR, { recursive: true });
        writeFileSync(storagePath(sessionId), JSON.stringify(payload));
    }
    catch {
        // Persistence is best-effort: the live in-memory trail still works.
    }
}
function loadSessionFromDisk(sessionId) {
    if (changesBySession.has(sessionId))
        return;
    try {
        const raw = readFileSync(storagePath(sessionId), 'utf8');
        const turns = JSON.parse(raw);
        const map = new Map();
        for (const turn of turns) {
            const files = new Map();
            for (const file of turn.files)
                files.set(file.path, file);
            map.set(turn.turn, files);
        }
        changesBySession.set(sessionId, map);
        const maxTurn = [...map.keys()].sort((a, b) => b - a)[0];
        if (maxTurn !== undefined)
            latestTurnBySession.set(sessionId, maxTurn);
    }
    catch {
        // No persisted trail yet; keep the in-memory map absent.
    }
}
function sessionIdOf(session) {
    return session?.id ?? session?.key ?? 'unknown';
}
function cwdOf(session) {
    return session?.header?.cwd ?? process.cwd();
}
function resolveFilePath(session, rawPath) {
    return isAbsolute(rawPath) ? rawPath : resolve(cwdOf(session), rawPath);
}
function turnOf(data, sessionId) {
    const raw = data?.turn ?? data?.stepTurn ?? data?.step_turn;
    const turn = typeof raw === 'number' && Number.isFinite(raw) ? raw : latestTurnBySession.get(sessionId) ?? 0;
    if (turn > (latestTurnBySession.get(sessionId) ?? 0))
        latestTurnBySession.set(sessionId, turn);
    return turn;
}
function trackLatestTurn(sessionId, data) {
    const raw = data?.turn;
    const turn = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
    if (turn !== undefined && turn > (latestTurnBySession.get(sessionId) ?? 0)) {
        latestTurnBySession.set(sessionId, turn);
    }
}
function diffLines(before, after) {
    return createTwoFilesPatch('a', 'b', before, after, '', '', { context: 3 });
}
function countDiff(patch) {
    let plus = 0;
    let minus = 0;
    for (const line of patch.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++'))
            plus += 1;
        else if (line.startsWith('-') && !line.startsWith('---'))
            minus += 1;
    }
    return { plus, minus };
}
function computeAfter(toolName, args, before) {
    if (toolName === 'write') {
        return typeof args.content === 'string' ? args.content : null;
    }
    if (toolName === 'edit') {
        const oldString = typeof args.old_string === 'string' ? args.old_string : '';
        const newString = typeof args.new_string === 'string' ? args.new_string : '';
        if (oldString === '')
            return before; // degenerate: no-op
        const index = before.indexOf(oldString);
        return index < 0 ? before : before.slice(0, index) + newString + before.slice(index + oldString.length);
    }
    if (toolName === 'str_replace_editor') {
        const command = String(args.command ?? '');
        if (command === 'create')
            return typeof args.file_text === 'string' ? args.file_text : null;
        if (command === 'str_replace') {
            const oldStr = typeof args.old_str === 'string' ? args.old_str : '';
            const newStr = typeof args.new_str === 'string' ? args.new_str : '';
            if (oldStr === '')
                return before;
            const index = before.indexOf(oldStr);
            return index < 0 ? before : before.slice(0, index) + newStr + before.slice(index + oldStr.length);
        }
        if (command === 'insert') {
            const newStr = typeof args.new_str === 'string' ? args.new_str : '';
            const insertLine = typeof args.insert_line === 'number' ? args.insert_line : 0;
            const lines = before.split('\n');
            const at = Math.max(0, Math.min(insertLine, lines.length));
            lines.splice(at, 0, newStr);
            return lines.join('\n');
        }
        return null; // view / undo_edit: no content change
    }
    return null;
}
function upsert(sessionId, turn, filePath, change) {
    loadSessionFromDisk(sessionId);
    let turns = changesBySession.get(sessionId);
    if (turns === undefined) {
        turns = new Map();
        changesBySession.set(sessionId, turns);
    }
    let files = turns.get(turn);
    if (files === undefined) {
        files = new Map();
        turns.set(turn, files);
    }
    files.set(filePath, change);
    persistSession(sessionId);
}
function handleToolCall(session, eventType, data) {
    const toolName = String(data?.name ?? data?.tool ?? '');
    if (!TRACKED_TOOLS.has(toolName))
        return;
    const rawArgs = data?.arguments ?? data?.args ?? data?.input ?? {};
    let args;
    if (typeof rawArgs === 'string') {
        try {
            args = JSON.parse(rawArgs);
        }
        catch {
            return;
        }
    }
    else {
        args = rawArgs;
    }
    const rawPath = args?.file_path ?? args?.path ?? args?.file ?? '';
    if (typeof rawPath !== 'string' || rawPath === '')
        return;
    const sessionId = sessionIdOf(session);
    const turn = turnOf(data, sessionId);
    const filePath = resolveFilePath(session, rawPath);
    let before = '';
    try {
        before = readFileSync(filePath, 'utf8');
    }
    catch {
        before = ''; // new file / not readable
    }
    const after = computeAfter(toolName, args, before);
    if (after === null || after === before)
        return;
    const patch = diffLines(before, after);
    const { plus, minus } = countDiff(patch);
    upsert(sessionId, turn, filePath, { path: filePath, plus, minus, diff: patch });
}
function listForTurn(sessionId, turn) {
    loadSessionFromDisk(sessionId);
    return [...(changesBySession.get(sessionId)?.get(turn)?.values() ?? [])];
}
function listForSession(sessionId) {
    loadSessionFromDisk(sessionId);
    const turns = changesBySession.get(sessionId);
    if (turns === undefined)
        return [];
    return [...turns.entries()]
        .map(([turn, files]) => ({ turn, files: [...files.values()] }))
        .sort((a, b) => b.turn - a.turn);
}
function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
export function apply(ctx) {
    ctx.on('session/event', (session, event) => {
        const data = event?.data ?? {};
        const sessionId = sessionIdOf(session);
        trackLatestTurn(sessionId, data);
        if (event?.type === 'tool/call') {
            handleToolCall(session, String(event?.type ?? ''), data);
        }
    });
    // The webServer capability is optional (headless runs keep the plugin harmless).
    ctx.inject(['webServer'], (webCtx) => {
        webCtx.effect(() => webCtx.webServer.register({
            kind: 'prefix',
            path: '/api/dsh-diff-review',
            handler: (req, res) => {
                const url = new URL(req.url ?? '/', 'http://localhost');
                if (req.method !== 'GET') {
                    json(res, 405, { ok: false, error: 'method-not-allowed' });
                    return;
                }
                if (url.pathname === '/api/dsh-diff-review/turn') {
                    const sessionId = url.searchParams.get('session') ?? '';
                    const turn = Number(url.searchParams.get('turn') ?? '0');
                    json(res, 200, { ok: true, files: listForTurn(sessionId, turn) });
                    return;
                }
                if (url.pathname === '/api/dsh-diff-review/session') {
                    const sessionId = url.searchParams.get('session') ?? '';
                    json(res, 200, { ok: true, turns: listForSession(sessionId) });
                    return;
                }
                json(res, 404, { ok: false, error: 'not-found' });
            },
        }), '@dsh-external/dsh-diff-review: api routes');
    });
}
//# sourceMappingURL=index.js.map