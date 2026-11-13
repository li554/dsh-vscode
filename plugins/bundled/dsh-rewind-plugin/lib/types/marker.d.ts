/**
 * The rewind marker's message-source identity.
 *
 * A producer owns its source `kind` outright (`MessageSourceMap` is
 * merge-extensible and has no catch-all `plugin` kind since session format v4),
 * so this module declares the `dsh-rewind` source every marker carries. Kept in
 * a leaf with no cordis or node imports.
 *
 * @module dsh-rewind/marker
 */
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'dsh-rewind': {
            kind: 'dsh-rewind';
        };
    }
}
/** The marker's source: one producer-owned kind, no private fields. */
export declare const REWIND_MARKER_SOURCE: Readonly<{
    readonly kind: "dsh-rewind";
}>;
