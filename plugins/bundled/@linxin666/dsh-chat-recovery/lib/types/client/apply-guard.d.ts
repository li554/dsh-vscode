/**
 * Cross-module-instance apply guard for the chat-recovery client bundle.
 *
 * The client factory can run more than once in a single page lifetime (a
 * stale bundle mixed with a rebuilt one while `dsh web` is restarted).
 * Without a guard, every factory run mounts its own turn actions and retry
 * dock rows, so the transcript shows duplicated buttons.
 *
 * The flag lives on globalThis so separate module instances (independent
 * factory runs) still share one guard. First claim wins; later claims become
 * no-ops until the claim is released (fiber unload / hot-reload) or the page
 * reloads.
 */
declare global {
    var __dshChatRecoveryApplied: boolean | undefined;
}
/** Claims the plugin apply slot. Returns true when this call won the slot. */
export declare function claimChatRecoveryApply(): boolean;
/** Releases the claim (fiber cleanup) so a hot-reloaded bundle can claim again. */
export declare function releaseChatRecoveryApply(): void;
