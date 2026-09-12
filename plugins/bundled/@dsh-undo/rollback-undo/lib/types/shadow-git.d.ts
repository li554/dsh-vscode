/** Private shadow-Git snapshots for one supported workspace. */
import type { z } from 'zod';
import type { ConversationUndoTree } from './types.ts';
/** One workspace path changed between two private Shadow Git trees. */
export interface ShadowGitChange {
    readonly path: string;
    readonly status: 'added' | 'modified' | 'deleted';
    readonly addedBytes: number;
    readonly deletedBytes: number;
}
/** Reject non-worktree paths before an operation can restore files.
 * @param workspace - Candidate worktree root.
 * @returns Resolution only for a supported non-bare, submodule-free worktree.
 */
export declare function assertSupportedWorkspace(workspace: string): Promise<void>;
/** Per-journal Git repository holding trees without touching user refs, commits, or index. */
export declare class ShadowGit {
    private readonly workspace;
    private readonly shadowGit;
    constructor(workspace: string, shadowGit: string); /** Create a tree from all Git-supported workspace paths.
     * @returns Private Git tree id for all supported workspace paths.
     */
    capture(): Promise<ConversationUndoTree>;
    /** Restore an exact tree, deleting only paths captured in `from` but absent from `target`.
     * @param target - Private tree to materialize.
     * @param from - Prior private tree defining removable captured paths.
     */
    restore(target: ConversationUndoTree, from: ConversationUndoTree): Promise<void>;
    /** List Git-supported paths changed between two private trees without touching the workspace. */
    changes(from: ConversationUndoTree, target: ConversationUndoTree): Promise<readonly ShadowGitChange[]>;
    /** Return a bounded unified patch for one captured path without touching the workspace. */
    diffPreview(from: ConversationUndoTree, target: ConversationUndoTree, path: string): Promise<string | undefined>;
    /** Check whether the worktree exactly matches one private tree, without capturing it.
     * @param tree - Private tree to compare the worktree against.
     * @returns Whether every tracked path matches and no untracked path exists.
     */
    verifyMatches(tree: ConversationUndoTree): Promise<boolean>;
    /** Refresh the index stat cache so a later {@link verifyMatches} skips the full-worktree stat pass. */
    refreshStats(): Promise<void>;
    private ensure;
    /** Read one private-tree blob's byte size without materialising it in the worktree. */
    private blobSize;
    private removeCapturedPath;
}
/** Atomically replace a JSON record in the plugin-owned data directory.
 * @param path - Plugin-owned JSON target path.
 * @param value - JSON-serializable record to replace atomically.
 */
export declare function writeJson(path: string, value: unknown): Promise<void>;
/** Read one optional JSON record from the plugin-owned data directory.
 * @param path - Plugin-owned JSON record path.
 * @param schema - Durable-boundary validator.
 * @returns Parsed record, or `undefined` when absent.
 */
export declare function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined>;
/** Encode one opaque id as one portable data-directory component.
 * @param value - Opaque identifier.
 * @returns Portable data-directory component.
 */
export declare function dataComponent(value: string): string;
//# sourceMappingURL=shadow-git.d.ts.map