/**
 * dsh-rewind client half: the `/rewind` command decoration, the locale
 * registration, the mode popover it opens, the visibility layer, and the
 * per-message rewind action.
 *
 * A durable message's action lives in the Chat row's own actions row: `mount.tsx`
 * takes over the official user/steering renderer identity and injects one more
 * child into that row. Unclaimed (pending) steering input has no such seat, so
 * `pending-mount.tsx` attaches the retract action through the only DOM path the
 * plugin keeps. The
 * command decoration (`ctx.commandUi.decorate`) makes a bare `/rewind` (or its
 * alias `/undo`) open the harness's own popupSelect instead of executing; the
 * parameterized `@<seq>` form stays the execution channel, while the popover's
 * impact and candidate reads go over the host's exact `/api` routes. The
 * executed rewind and its composer refill live in `rewind-flow.ts`.
 *
 * @module dsh-rewind/client
 */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
export declare const name = "dsh-rewind";
export declare const inject: string[];
/**
 * The client plugin root context read by `apply(ctx)`. Local structural face:
 * the harness client context is a cordis `Context` augmented by runtime
 * services, so the plugin declares the subset it reads. `sessions` is the real
 * `ISessions` from `@deepseek-ai/dsh-api-session-controller`.
 */
export interface ClientContext {
    effect(execute: (() => Iterable<unknown>) | (() => void), label?: string): unknown;
    locale: {
        register(namespace: string, messages: Record<string, Record<string, string>>): unknown;
        bind(namespace: string): (key: string) => string;
        subscribe(cb: () => void): () => void;
    };
    sessions: ISessions;
    get(name: string): unknown;
    slots: unknown;
    commandUi: unknown;
    /** Per-entry configuration forms (this bundle's own entry included). */
    configForms: {
        get<T>(entryId: string): ConfigForm<T>;
    };
}
/**
 * Client plugin body: command decoration + parameterized guard + locale +
 * visibility + the settings card.
 * @param ctx - client root context carrying `slots`, `sessions`, `locale` and `commandUi`.
 */
export declare function apply(ctx: ClientContext): void;
