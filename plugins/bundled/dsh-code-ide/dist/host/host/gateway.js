import { createApiHandler } from './api.js';
import { TERMINAL_CAPABILITY, WORKSPACE_FILES_CAPABILITY, WORKSPACE_SEARCH_CAPABILITY, } from './capabilities.js';
import { hostError, IdeHostError } from './errors.js';
import { createMediaHandler } from './media.js';
import { rejectionMessage, requestRejection } from './connection-auth.js';
import { createStaticHandler } from './static.js';
import { rejectUpgrade } from './terminal.js';
function sendHttpError(response, error) {
    const projected = hostError(error);
    const body = JSON.stringify({ error: { code: projected.code, message: projected.message } });
    response.writeHead(projected.status, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'x-content-type-options': 'nosniff',
    });
    response.end(body);
}
/** Own every browser route while all versioned Host capabilities are live. */
export function ideGateway(ctx, config) {
    const files = ctx[WORKSPACE_FILES_CAPABILITY];
    const terminal = ctx[TERMINAL_CAPABILITY];
    const search = ctx[WORKSPACE_SEARCH_CAPABILITY];
    const api = createApiHandler(files, {
        maxRequestBytes: config.maxRequestBytes,
        maxTerminalSessions: config.maxTerminalSessions,
        logger: ctx.logger,
    }, search);
    const staticFiles = createStaticHandler(config.staticRoot, config.routePrefix);
    const media = createMediaHandler(files);
    const apiPath = `${config.routePrefix}/api`;
    const mediaPath = `${config.routePrefix}/media`;
    const terminalPath = `${config.routePrefix}/terminal`;
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: config.routePrefix,
        handler: async (request, response) => {
            const rejection = requestRejection(ctx, request);
            if (rejection !== undefined) {
                sendHttpError(response, new IdeHostError(rejection === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', rejectionMessage(rejection), rejection));
                return;
            }
            let pathname;
            try {
                pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            }
            catch (error) {
                sendHttpError(response, new IdeHostError('INVALID_URL', 'Invalid request URL.', 400, { cause: error }));
                return;
            }
            if (pathname === apiPath) {
                await api(request, response);
                return;
            }
            if (pathname === mediaPath) {
                await media(request, response);
                return;
            }
            if (pathname === terminalPath) {
                response.writeHead(426, { connection: 'Upgrade', upgrade: 'websocket' });
                response.end('WebSocket upgrade required');
                return;
            }
            if (pathname.startsWith(`${apiPath}/`) || pathname.startsWith(`${mediaPath}/`)) {
                sendHttpError(response, new IdeHostError('NOT_FOUND', 'Unknown IDE API route.', 404));
                return;
            }
            try {
                await staticFiles(request, response, pathname);
            }
            catch (error) {
                if (!response.headersSent)
                    sendHttpError(response, error);
                else
                    response.destroy();
            }
        },
    }), 'dsh-code-ide: HTTP routes');
    ctx.effect(() => ctx.webServer.registerUpgrade({
        path: terminalPath,
        handler: async (request, socket, head) => {
            const rejection = requestRejection(ctx, request);
            if (rejection !== undefined) {
                rejectUpgrade(socket, rejection, rejectionMessage(rejection));
                return;
            }
            await terminal.upgrade(request, socket, head);
        },
    }), 'dsh-code-ide: terminal WebSocket');
}
ideGateway.inject = [
    'webServer',
    WORKSPACE_FILES_CAPABILITY,
    TERMINAL_CAPABILITY,
    WORKSPACE_SEARCH_CAPABILITY,
];
