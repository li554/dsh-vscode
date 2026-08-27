import type { FsLike } from './fs.ts';
import type { InventoryReport, ManifestFacts, WorkspaceSettings } from './types.ts';
import type { YamlEngine } from './yaml.ts';
interface LockedDep {
    specifier: string;
    version: string;
}
export interface LockfileParse {
    status: 'ok' | 'broken' | 'missing';
    lockfileVersion?: string;
    importer?: Map<string, LockedDep>;
    error?: string;
}
/** Parse the importer dependencies out of a pnpm lockfile (v9 layout). */
export declare function parseLockfileImporter(text: string, engine: YamlEngine, label?: string): LockfileParse;
/** Parse profile pnpm-workspace.yaml settings (missing file = unaffected). */
export declare function parseWorkspaceSettings(text: string | undefined, engine: YamlEngine): WorkspaceSettings | undefined;
/** Build the dependency/lockfile/install-state inventory for one profile. */
export declare function inventoryProfile(fs: FsLike, dir: string, manifest: ManifestFacts, engine: YamlEngine): Promise<InventoryReport>;
export {};
