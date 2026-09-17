import { isTrustedLocalRequest } from './trust.js';
function hasRequestRejection(value) {
    return typeof value === 'object' && value !== null
        && typeof value.requestRejection === 'function';
}
/**
 * Use the newer Host's browser-auth fence when available. Older Harness
 * versions do not provide Connection, so retain the original loopback fence.
 */
export function requestRejection(ctx, request) {
    const connection = ctx.get?.('connection');
    if (hasRequestRejection(connection))
        return connection.requestRejection(request);
    return isTrustedLocalRequest(request) ? undefined : 403;
}
/** Project an authentication rejection without exposing host-auth details. */
export function rejectionMessage(status) {
    return status === 401 ? 'Unauthorized' : 'Forbidden';
}
