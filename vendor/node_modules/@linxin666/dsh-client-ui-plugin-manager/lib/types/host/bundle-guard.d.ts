/**
 * Post-mutation duplicate-mount guard for the gateway host half. The official
 * CLI's bundle reconciliation appends EVERY dependency that declares
 * `dsh.bundle` to the profile manifest's `dsh.profile.bundles` — including
 * packages the composition already mounts through a patch row (the family
 * aggregate mounts dsh-better-sidebar as the insert row
 * `{ id: 'better-sidebar', name: 'dsh-better-sidebar' }` while the package
 * also sits in the profile's dependencies). The bundles layer then mounts the
 * package a second time and the next boot dies on duplicate routes
 * (`webserver: duplicate prefix route "/sidebar/api"`). This module decides,
 * from the before-state composition, which newly added bundles entries are
 * such duplicate mounts; the gateway strips exactly those entries back out.
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */
import type { ProfileFacts } from './profile.ts';
/** The before-state composition facts the guard reads. */
export interface GuardSnapshot {
    /** The profile patch text captured before the mutation. */
    patchText: string;
    /** Dependency names captured before the mutation. */
    dependencies: readonly string[];
    /** Profile-layer row enablement by entry id (bare rows), before the mutation. */
    rowEnabled: ReadonlyMap<string, boolean>;
}
/**
 * The bundles entries a mutation newly added: present after, absent before.
 * Entries the user already had are never the guard's business.
 * @param before - bundles list before the mutation.
 * @param after - bundles list after the mutation.
 * @returns the newly added entries, in after-state order.
 */
export declare function newlyAddedBundles(before: readonly string[], after: readonly string[]): string[];
/**
 * The package names the before-state composition already mounts through patch
 * rows: the profile patch's own rows (bare and insert-format) plus every
 * before-state dependency's own bundle patch insert entries (the aggregate's
 * rows section lives there, not in the profile layer). A tolerant read: a
 * broken patch file yields no names rather than failing the mutation.
 * @param facts - resolved profile locations.
 * @param before - the before-state capture.
 * @returns the set of row-mounted package names.
 */
export declare function rowMountedPackageNames(facts: ProfileFacts, before: GuardSnapshot): Promise<ReadonlySet<string>>;
/**
 * The newly added bundles entries that duplicate an existing row mount and
 * must be stripped to keep the next boot alive.
 * @param facts - resolved profile locations.
 * @param before - the before-state capture.
 * @param beforeBundles - the bundles list before the mutation.
 * @param afterBundles - the bundles list after the mutation.
 * @returns the entries to remove from `dsh.profile.bundles`.
 */
export declare function duplicateMountBundles(facts: ProfileFacts, before: GuardSnapshot, beforeBundles: readonly string[], afterBundles: readonly string[]): Promise<string[]>;
