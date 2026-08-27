/**
 * Gateway listing: the installed-plugin inventory read from the profile's
 * package.json, its node_modules manifests, and the patch rows' enablement.
 * The npm web runtime has no installer inventory service, so this module is
 * the read side of the gateway (the write side is the official CLI).
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */
import type { InstalledPluginItem } from '../core/protocol.ts';
import type { LayerSnapshot } from '../core/patch-diff.ts';
import { type ProfileFacts } from './profile.ts';
/** The listing result: plugin rows plus the raw layer snapshot for diffs. */
export interface GatewaySnapshot {
    plugins: InstalledPluginItem[];
    layer: LayerSnapshot;
}
/** Whether an install spec names a git/file/link source rather than a registry package. */
export declare function sourceKindOf(spec: string): 'npm' | 'git';
/**
 * The entry ids one installed dependency claims: the insert ids of its own
 * bundle patch, falling back to the package name. Shared by the listing read
 * side and the set-enabled write side so both agree on the id space — writing
 * package-name rows while reading bundle-patch ids made the switches inert.
 * @param facts - resolved profile locations.
 * @param name - dependency name (possibly scoped).
 * @returns the claimed entry ids, never empty.
 */
export declare function claimedEntryIdsOf(facts: ProfileFacts, name: string): Promise<string[]>;
/**
 * The insert rows one installed dependency claims, id plus the entry's own
 * name (falling back to the package name for plain plugins). The set-enabled
 * write side needs the entry's own name: the include patch semantics skip a
 * bare override row whose name mismatches the inserted entry's name.
 * @param facts - resolved profile locations.
 * @param name - dependency name (possibly scoped).
 * @returns the claimed rows, never empty.
 */
export declare function claimedEntryRowsOf(facts: ProfileFacts, name: string): Promise<Array<{
    id: string;
    name: string;
}>>;
/**
 * Build one installed-plugin row from the profile facts: version from the
 * installed manifest, enablement from the entry ids its own bundle patch
 * claims (plain plugins use the package name as the row id).
 * @param facts - resolved profile locations.
 * @param name - dependency name (possibly scoped).
 * @param spec - the install spec recorded in the profile dependencies.
 * @param rowEnabled - row enablement by id.
 * @returns the wire-shaped plugin row.
 */
export declare function buildPluginRow(facts: ProfileFacts, name: string, spec: string, rowEnabled: ReadonlyMap<string, boolean>): Promise<InstalledPluginItem>;
/**
 * Build the gateway listing and the layer snapshot.
 * @param facts - resolved profile locations.
 * @param patchText - current profile patch text.
 * @returns plugin rows (wire shape of the official list) and the layer state.
 */
export declare function snapshotGateway(facts: ProfileFacts, patchText: string): Promise<GatewaySnapshot>;
