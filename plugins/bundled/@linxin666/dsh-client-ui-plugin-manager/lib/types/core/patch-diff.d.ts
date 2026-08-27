/**
 * Layer diffing for the gateway host half: the profile patch rows and the
 * bundle list before an install are compared with the state after the
 * official CLI finishes, so the tab can render exactly what the install
 * changed — rows disabled or claimed, bundles added or removed — as a
 * reversible, attributable notice. Pure logic shared by both halves.
 * @module @linxin666/dsh-client-ui-plugin-manager/core
 */
/** Row/bundle membership state used by the diff. */
export type LayerState = 'enabled' | 'disabled' | 'uninstalled';
/** One layer snapshot: row enablement by id plus the bundle list. */
export interface LayerSnapshot {
    rows: ReadonlyMap<string, boolean>;
    bundles: readonly string[];
}
/** One observed membership change between two snapshots. */
export interface LayerChange {
    id: string;
    from: LayerState;
    to: LayerState;
}
/**
 * Diff two layer snapshots by id. Only entries whose membership state moved
 * are reported; unchanged entries are skipped.
 * @param before - snapshot taken before the operation.
 * @param after - snapshot taken after the operation.
 * @returns one change per moved id, sorted by id.
 */
export declare function diffLayer(before: LayerSnapshot, after: LayerSnapshot): LayerChange[];
/**
 * Drop the normal install outcome — entries that merely appear (a new plugin
 * mounting is the point of an install, not a conflict) — and keep every
 * change to an entry that existed before.
 * @param changes - the raw layer diff.
 * @returns the conflict-worthy changes.
 */
export declare function significantChanges(changes: LayerChange[]): LayerChange[];
/**
 * The ids of `claimed` already held by another entry. Bundle rows with the
 * same insert id double-mount at the next boot (duplicate entry id), so an
 * install claiming a taken id is a boot-blocking conflict.
 * @param claimed - the new plugin's claimed entry ids.
 * @param taken - every id already claimed by other plugins and patch rows.
 * @returns the overlapping ids, in claim order.
 */
export declare function overlappingIds(claimed: readonly string[], taken: ReadonlySet<string>): string[];
