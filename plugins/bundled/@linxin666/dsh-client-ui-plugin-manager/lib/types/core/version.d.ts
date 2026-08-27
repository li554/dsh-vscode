/**
 * DSH host version parsing and comparison for the update compatibility
 * check. The declared minimum lives in the published package manifest under
 * `dsh.engines.dsh`, falling back to the top-level `engines.dsh`; the only
 * supported form is `>=X.Y.Z[-prerelease]`.
 *
 * Comparison deliberately uses plain semver ordering instead of
 * `semver.satisfies`: npm's prerelease rule only allows a prerelease version
 * to satisfy a comparator set carrying a prerelease on the same
 * major.minor.patch tuple, which would reject a newer host line (0.1.1-rc.2)
 * against a declared `>=0.1.0-rc.8` — exactly the cross-cohort upgrade path
 * this check must allow. Everything here is pure and tolerant of untrusted
 * input: a malformed value means "cannot verify", which the callers treat as
 * a fail-closed verdict when a requirement was declared (issue #754).
 * @module @linxin666/dsh-client-ui-plugin-manager/core
 */
/** One parsed DSH host or package version. */
export interface DshVersion {
    major: number;
    minor: number;
    patch: number;
    /** Prerelease identifiers, numeric identifiers kept as numbers (semver order). */
    prerelease: readonly (number | string)[];
}
/**
 * Parse a DSH host or package version string.
 * @param value - e.g. `0.1.0-rc.8`, `v1.2.3`.
 * @returns the parsed version, or undefined when malformed.
 */
export declare function parseDshVersion(value: string): DshVersion | undefined;
/**
 * Compare two version strings by semver order (a release is newer than any
 * prerelease of the same tuple).
 * @returns -1 / 0 / 1, or undefined when either side is malformed.
 */
export declare function compareVersions(left: string, right: string): number | undefined;
/**
 * Whether a host version satisfies a declared `>=X.Y.Z[-prerelease]` minimum.
 * @param host - the running DSH host version.
 * @param minimum - the declared minimum; any form other than `>=<semver>`
 * (plain semver, `^`, `~`, multi-comparator ranges, empty) returns undefined.
 * @returns true / false, or undefined when the host version is malformed or
 * the minimum uses an unsupported form — callers treat undefined as
 * "cannot verify" and fail closed for declared requirements.
 */
export declare function meetsMinimumDsh(host: string, minimum: string): boolean | undefined;
/**
 * The bare minimum version for display: strips the `>=` operator (and an
 * optional leading `v`) from a declared requirement so UI copy that already
 * contains the comparison operator renders `0.1.1-rc.1` instead of
 * `>= >=0.1.1-rc.1`. Unsupported range forms render unchanged.
 * @param minimum - the declared minimum range.
 * @returns the version portion for display.
 */
export declare function displayMinimumVersion(minimum: string): string;
/**
 * Read the declared DSH minimum from a published registry manifest:
 * `dsh.engines.dsh` first, top-level `engines.dsh` as the fallback.
 * Defensive against malformed or untrusted metadata: anything that is not a
 * non-empty string reads as absent.
 * @param manifest - the decoded registry version manifest.
 * @returns the declared minimum, or undefined when not declared.
 */
export declare function dshRequirementOf(manifest: {
    dsh?: unknown;
    engines?: unknown;
}): string | undefined;
