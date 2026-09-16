/**
 * dsh-rewind client half: the `/rewind` command decoration, the locale
 * registration, and the session-scoped portal bridge that renders the
 * per-message ↶ rewind button (see
 * `portals.tsx` for the button itself).
 *
 * The button is NOT injected by hand into the DOM anymore: the plugin
 * registers a bridge into the harness's `conversation.session.header.actions`
 * list slot, and that bridge portals a React button into every user message's
 * IconActions row — the same rendering family as the copy button (a React
 * child of the actions row), without touching any harness source. The
 * registration is typed structurally (see `SlotsLike` in portals.tsx), so the
 * plugin never imports conversation UI types and survives harness version
 * drift.
 *
 * The text-driven flow is the harness's STANDARD command decoration
 * (`ctx.commandUi.decorate`): a bare `/rewind` (or its alias `/undo`) —
 * picked from the slash-menu completion, or typed in full and Entered —
 * opens the harness's own popupSelect shell (search, ↑↓/Enter, Esc) listing
 * the rewind candidates instead of executing the command. Picking one
 * continues the SAME flow as the ↶ button: the mode popover, both-impact
 * confirmation, execution, row hiding and the composer refill
 * (`runRewindAndFill`). The parameterized forms (`/rewind @<seq> chat|both`,
 * `/rewind preview …`) stay internal channels the ↶ button and the popover
 * drive through `session.command`.
 *
 * @module dsh-rewind/client
 */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
export declare const name = "dsh-rewind";
export declare const inject: string[];
/**
 * The client plugin root context read by `apply(ctx)`. Local structural face:
 * the harness client context is a cordis `Context` augmented by runtime
 * services, so the plugin declares the subset it reads. `sessions` is the real
 * `ISessions` from `@deepseek-ai/dsh-api-session-controller`.
 */
export interface ClientContext {
    effect(execute: () => Iterable<unknown>, label?: string): unknown;
    locale: {
        register(namespace: string, messages: Record<string, Record<string, string>>): unknown;
        bind(namespace: string): (key: string) => string;
        subscribe(cb: () => void): () => void;
    };
    sessions: ISessions;
    get(name: string): unknown;
    slots: unknown;
    commandUi: unknown;
}
/**
 * Client plugin body: command decoration + parameterized guard + locale + the
 * portal bridge.
 * @param ctx - client root context carrying `slots`, `sessions`, `locale` and `commandUi`.
 */
export declare function apply(ctx: ClientContext): void;
/**
 * Public contract — rewind visibility. Stable, semver-protected; the rest of
 * this module is internal. See `docs/contract/client-contract.md`.
 */
export { hiddenSeqsOf, targetSeqOfArgs, type HiddenChat } from './hidden.ts';
