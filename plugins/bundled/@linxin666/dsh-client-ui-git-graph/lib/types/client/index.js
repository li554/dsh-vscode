/**
 * Git-graph surface plugin, browser half. The branch selector is rendered
 * only for blank sessions: it uses the input selector row's context hole
 * (`conversation.input.selector.context`) beside the official workspace
 * selector. When that shell slot is unavailable, it waits for
 * {@link CONTEXT_FALLBACK_MS} then uses `conversation.input.dock` for the
 * blank-session hero phase, where it joins the official hero chip row after
 * the agent-preset seat. Active sessions render no branch-selection control.
 *
 * All git facts arrive through this package's host /git routes. The inject
 * face carries the business verbs and the components remain pure props. The
 * published npm SDK (rc.6) dropped the context-hole type, so it is declared
 * locally below for type-checked registration.
 * @module dsh-git-graph/client
 */
import { GitApi, subscribeChanges } from "./api.js";
import { BranchChip } from "./chips/BranchChip.js";
import { en, zh } from "./locales.js";
export { BranchChip } from "./chips/BranchChip.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'git-graph';
/** Required services: slots for the selector-context entry, sessions for the cwd lookup, locale for the copy. */
export const inject = ['slots', 'sessions', 'connection', 'locale'];
/** The session-cwd lookup failure shared by the injected verbs. */
const NO_WORKSPACE = { code: 'workspace-unknown', message: 'session has no workspace' };
/**
 * How long the chip waits for the selector-context declaration before
 * falling back to the input dock. The window covers the shell's first
 * render of the input selector row after the conversation service is up;
 * shells that never declare the hole (rc.6) land on the dock after it.
 */
export const CONTEXT_FALLBACK_MS = 2000;
/**
 * Client plugin body: the branch chip entry with its git verbs, on the
 * selector-context hole with an input-dock fallback.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => {
        try {
            return ctx.locale.register(NS, { zh, en });
        }
        catch {
            return () => { };
        }
    }, 'dsh-git-graph: dictionaries');
    const git = new GitApi();
    // The context-fallback timer, armed once the conversation seam is up and
    // cleared when this fiber unloads (the slot inject waits die with the
    // fiber too, so no seat survives an unload).
    let fallbackTimer;
    ctx.effect(() => () => {
        if (fallbackTimer !== undefined)
            clearTimeout(fallbackTimer);
    }, 'dsh-git-graph: context fallback timer');
    // Conditional mount: the conversation service being up is the
    // registration-safe signal (the GoalDock/QueueDock seam). The chip then
    // prefers the selector-context hole and falls back to the input dock when
    // that declaration never arrives.
    ctx.inject(['slots', 'conversation', 'sessions'], (scope) => {
        const sessions = scope.sessions;
        /** The session's workspace root, resolved at call time from the sessions baseline. */
        const cwdOf = (sessionId) => sessionId === undefined ? undefined : sessions.list.getSnapshot().byId[sessionId]?.cwd;
        /** The injected face shared by every seat this chip registers into. */
        const injected = () => {
            /** Resolve the workspace root for one git call. */
            const pathOf = (sessionId) => {
                const cwd = cwdOf(sessionId);
                if (cwd === undefined || cwd === '')
                    return { ok: false, error: NO_WORKSPACE };
                return { ok: true, path: cwd };
            };
            return {
                repoStatus: async (sessionId) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return null;
                    const result = await git.status(resolved.path);
                    return result.ok ? result.value : null;
                },
                branches: async (sessionId) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return null;
                    const result = await git.branches(resolved.path);
                    return result.ok ? result.value : null;
                },
                switchBranch: async (sessionId, branch) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return { ok: false, error: resolved.error };
                    const result = await git.switchBranch(resolved.path, branch);
                    return result.ok ? { ok: true, branch: result.value.branch } : result;
                },
                createBranch: async (sessionId, name) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return { ok: false, error: resolved.error };
                    const result = await git.createBranch(resolved.path, name);
                    return result.ok ? { ok: true, branch: result.value.branch } : result;
                },
                graph: async (sessionId, limit) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return null;
                    const result = await git.graph(resolved.path, limit);
                    return result.ok ? result.value : null;
                },
                subscribeChanges: (sessionId, onChange) => {
                    const resolved = pathOf(sessionId);
                    if (!resolved.ok)
                        return () => { };
                    return subscribeChanges(resolved.path, onChange);
                },
            };
        };
        // The entry shape shared by both seats; each register call spells the
        // seat's literal name so its own declaration is checked.
        const chipEntry = { id: 'git-graph', order: 100, locale: NS, inject: injected };
        // Declaration-aware with a fallback. A bare register() would throw on
        // shells that dropped the hole (SDK SlotCore.register rejects undeclared
        // slots), so both seats route through inject like the pet / remote-web-ui
        // entries. The preferred context wait resolves the moment the shell
        // declares the hole; when it never does (rc.6 and the current shipped
        // shell), the fallback disposes that wait and uses the dock only for the
        // blank-session hero phase. Exactly one seat mounts: a context declaration
        // landing after the fallback finds the wait gone.
        let mounted = false;
        const disposeContextWait = scope.slots.inject('conversation.input.selector.context', () => {
            mounted = true;
            try {
                return scope.slots.register({ name: 'conversation.input.selector.context', ...chipEntry }, BranchChip);
            }
            catch {
                return () => { };
            }
        });
        fallbackTimer = setTimeout(() => {
            if (mounted)
                return;
            disposeContextWait();
            scope.slots.inject('conversation.input.dock', () => {
                try {
                    return scope.slots.register({ name: 'conversation.input.dock', ...chipEntry }, BranchChip);
                }
                catch {
                    return () => { };
                }
            });
        }, CONTEXT_FALLBACK_MS);
    });
}
