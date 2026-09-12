/** Self-update orchestration for the plugin workspace (pull, install, rebuild). */
/** Locate the plugin workspace root: this module sits at
 * `<root>/packages/rollback-undo/<src|lib>/update.<ts|js>`, three levels below
 * the root under both the source and built layouts.
 * @returns Absolute path of the installable plugin workspace.
 * @throws When the expected marker file is absent (unexpected install layout).
 */
export declare function pluginWorkspaceRoot(): string;
/** Outcome of one fast-forward pull. */
export interface PullOutcome {
    readonly before: string;
    readonly after: string;
    readonly changed: boolean;
}
/** Fast-forward the workspace and report whether HEAD moved.
 * @param root - Plugin workspace root (a git checkout).
 * @returns HEAD ids before and after the pull.
 * @throws With git's stderr when the pull is rejected or the directory is not a checkout.
 */
export declare function pullFastForward(root: string): Promise<PullOutcome>;
/** Pull, install, and rebuild the plugin workspace in one transaction-shaped pass.
 * @param root - Plugin workspace root (a git checkout).
 * @returns User-facing summary text (already up to date, or updated and rebuilt).
 * @throws With a user-facing message at the first failing step.
 */
export declare function performPluginUpdate(root: string): Promise<string>;
//# sourceMappingURL=update.d.ts.map