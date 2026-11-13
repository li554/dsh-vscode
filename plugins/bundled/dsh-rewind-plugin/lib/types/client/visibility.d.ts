/**
 * Snapshot-level rewind visibility.
 *
 * DSH's Chat builder already supports hidden rows: a node stays in the node
 * store (so the composer can read its text/images) but leaves `order`,
 * `locations`, Turn navigation, and grouping whenever its `visibility` is
 * `'hidden'`. This module wraps the registered `chat` view builder and marks
 * the nodes inside an executed rewind's `[target, marker]` span hidden before
 * the builder sees them.
 *
 * The seam is private: `uiConversation.views` is a first-party registry and
 * `definition.create()` is not an extension point. Its shape is checked and it
 * is restored on unload.
 *
 * @module dsh-rewind/client/visibility
 */
import { type ChatConversationViewNode } from './hidden.ts';
interface BuilderLike {
    readonly empty: unknown;
    replace(input: BuilderInput): unknown;
    apply(input: BuilderApplyInput): unknown;
    groupInput?(): unknown;
    publish?(): void;
}
interface BuilderInput {
    readonly nodes: readonly ChatConversationViewNode[];
    readonly timeline: unknown;
    readonly changedTurns?: readonly number[];
}
interface BuilderApplyInput {
    readonly upserts: readonly ChatConversationViewNode[];
    readonly timeline: unknown;
    readonly changedTurns?: readonly number[];
}
interface SessionsLike {
    readonly list?: {
        getSnapshot(): {
            readonly ids?: readonly string[];
            readonly byId?: Readonly<Record<string, {
                readonly retainedBy?: Readonly<Record<string, number>>;
            }>>;
        };
    };
}
/** Context subset the installer needs; structurally satisfied by the client root. */
export interface VisibilityContext {
    get(name: string): unknown;
    effect?(execute: () => (() => void) | void, label?: string): unknown;
    inject?(names: readonly string[], callback: (scope: VisibilityContext) => void): unknown;
    readonly sessions?: SessionsLike;
}
/**
 * Wrap the registered `chat` view builder so rewind spans enter the builder as
 * `visibility: 'hidden'`. Idempotent across registry changes and HMR.
 * @param ctx - client root context.
 */
export declare function installChatViewVisibility(ctx: VisibilityContext): void;
/**
 * Structural wrapper over the registered Chat builder. It forwards every
 * builder method, keeps the original node objects, and only changes
 * `visibility`. A full replacement is used whenever the cut set changes;
 * otherwise it stays on the builder's incremental `apply` path.
 */
export declare class RewindVisibilityBuilder implements BuilderLike {
    private readonly inner;
    private originals;
    private commands;
    private byTurn;
    private turnProcess;
    private derived;
    private cuts;
    private cutSignature;
    private lastSignature;
    /** @param inner - the real Chat builder. */
    constructor(inner: BuilderLike);
    get empty(): unknown;
    replace(input: BuilderInput): unknown;
    apply(input: BuilderApplyInput): unknown;
    groupInput(): unknown;
    publish(): void;
    private setAll;
    private setOriginal;
    private unindex;
    private refreshCuts;
    private deriveAll;
    private deriveOne;
    private deriveTurnProcess;
}
export {};
