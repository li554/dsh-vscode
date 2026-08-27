import type { FsLike } from './fs.ts';
import type { Diagnostic, EntryRow, InventoryReport, ManifestFacts, PatchParseResult, ToolchainReport } from './types.ts';
export interface ProfileDiagnosisInput {
    home: string;
    profile: string;
    dir: string;
    fs: FsLike;
    manifest: ManifestFacts;
    manifestText: string;
    /** Delegate: whether a bundle package is resolvable from install or profile. */
    bundleResolvable(name: string): boolean;
    /** Delegate: whether a resolved bundle declares dsh.bundle.patch. */
    bundleDeclaresPatch(name: string): boolean | undefined;
    profilePatch?: PatchParseResult;
    homePatch?: PatchParseResult;
    /** Composed rows of every parseable patch layer, for row-level checks. */
    rows?: EntryRow[];
    inventory?: InventoryReport;
    toolchain?: ToolchainReport;
    env: {
        DSH_HOME?: string;
    };
}
/** Diagnose one profile from pre-fetched state. */
export declare function diagnoseProfile(input: ProfileDiagnosisInput): Diagnostic[];
/** Sort diagnostics deterministically: severity, code, path. */
export declare function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[];
/** Scan the DSH-managed fallback directory for link anomalies. */
export declare function diagnoseFallback(fs: FsLike, home: string): Promise<Diagnostic[]>;
