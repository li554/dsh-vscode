/**
 * @dsh-external/dsh-diff-review — host half.
 *
 * Tracks file-editing tool calls (`edit` / `write` / `str_replace_editor`) per
 * session turn from the `session/event` feed, computes a unified diff and
 * +/− line counts for each touched file, and serves that data to the browser
 * half through two JSON endpoints:
 *
 *   GET /api/dsh-diff-review/turn?session=<id>&turn=<n>
 *   GET /api/dsh-diff-review/session?session=<id>
 *
 * Deliberately git-free: a workspace without a repository still gets a review
 * trail for every agent edit.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "@dsh-external/dsh-diff-review";
export declare const inject: readonly string[];
export interface FileChangeSummary {
    path: string;
    plus: number;
    minus: number;
    diff: string;
}
export interface TurnChangeSummary {
    turn: number;
    files: FileChangeSummary[];
}
export declare function apply(ctx: Context): void;
