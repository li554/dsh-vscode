import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-mnemon-starter";
export declare const provide: string[];
/**
 * The separate readiness Entry of 0.5.18 and 0.5.19, kept for compositions that
 * still insert it; the Starter's own group (`dsh-mnemon/bundle`) now prepares itself.
 */
export declare function apply(ctx: Context): Promise<void>;
