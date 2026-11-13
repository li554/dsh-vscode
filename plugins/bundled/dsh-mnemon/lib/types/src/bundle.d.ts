import type { Context } from '@deepseek-ai/cordis';
declare const groupKey: unique symbol;
declare const init: unique symbol;
/**
 * The Starter's component group (`mnemon-bundle`). It makes the Starter's
 * dependency closure visible, then mounts the children with the Loader's own
 * `cordis:group`, so a component enabled without a restart resolves and no
 * separate readiness Entry can be turned off while the group waits for it.
 */
export default class MnemonBundle {
    private readonly ctx;
    private readonly config;
    static inject: string[];
    static [groupKey]: boolean;
    constructor(ctx: Context, config: unknown);
    [init](): AsyncGenerator<() => void, void, unknown>;
}
export {};
