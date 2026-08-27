/**
 * Patch-list parsing and composition for the DSH entry-list dialect.
 *
 * The patch algorithm re-implements the documented loader semantics: an
 * entry list is patched in place by id-targeted overrides; `insert` entries
 * append to the root list or into a named group; a patch that matches no
 * target or names a different row warns and is skipped. The base list is
 * never mutated.
 */
import type { EntryRow, PatchEntry, PatchParseResult } from './types.ts';
import type { YamlEngine } from './yaml.ts';
/** Parse a patch-list document (top-level YAML array of patch entries). */
export declare function parsePatchList(text: string, engine: YamlEngine, label: string): PatchParseResult;
/**
 * Structural validation of patch entries (no composition context needed).
 * Returns non-fatal warnings: no-op entries, bad insert members, non-string
 * identifiers.
 */
export declare function validatePatchEntries(entries: PatchEntry[], label?: string): string[];
/**
 * Apply patch lists to an entry list. The input is never mutated; the result
 * is always detached from it. Warnings mirror the loader wording for
 * reportability (patch insert: entry "x" not found; patch: name mismatch
 * for "x" ...).
 */
export declare function applyPatches(base: EntryRow[], patches: PatchEntry[], warn?: (message: string) => void): EntryRow[];
/** Apply ordered layers over an empty root, in order (later wins). */
export declare function composeRows(layers: PatchEntry[][], warn?: (message: string) => void): EntryRow[];
/**
 * Collect every row id in a composed tree, including nested group children.
 */
export declare function collectIds(rows: EntryRow[]): string[];
/** Duplicate row ids in a composed tree: id -> occurrence count. */
export declare function duplicateIds(rows: EntryRow[]): {
    id: string;
    count: number;
}[];
/** Every plugin name referenced by the rows (excluding disabled rows). */
export declare function rowNames(rows: EntryRow[]): {
    name: string;
    count: number;
}[];
/** Find the settings row (id 'settings') and report its configured path. */
export declare function findSettingsRow(rows: EntryRow[]): {
    path: string;
    absolute: boolean;
} | undefined;
