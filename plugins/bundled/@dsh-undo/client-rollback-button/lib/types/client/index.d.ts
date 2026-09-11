/** Browser-half Cordis composition for the rollback header action. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required service and slot declarations. The Remote namespaces are mounted by this apply, so only the `remote` service is injected. */
export declare const inject: string[];
/** Mount the plugin Remote and register the session-header rollback action. */
export declare function apply(ctx: ClientContext): Promise<() => void>;
//# sourceMappingURL=index.d.ts.map