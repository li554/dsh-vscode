/** Package-owned invariant companion for rollback-undo. */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "rollback-undo-invariant";
/** Service required before this companion registers its ownership record. */
export declare const inject: string[];
/** Register the package invariant companion. */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map