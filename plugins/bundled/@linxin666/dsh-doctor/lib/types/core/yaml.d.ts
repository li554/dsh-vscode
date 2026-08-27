/** Minimal js-yaml surface the engine needs. */
export interface YamlModule {
    load(text: string, options?: Record<string, unknown>): unknown;
    dump(value: unknown, options?: Record<string, unknown>): string;
}
/** The engine's parse/stringify contract. */
export interface YamlEngine {
    parse(text: string): unknown;
    stringify(value: unknown): string;
    source: string;
}
export declare class YamlEngineError extends Error {
    readonly path: string;
    constructor(message: string, path?: string);
}
/** Build a YamlEngine over a js-yaml-compatible module. */
export declare function createYamlEngine(loader?: (id: string) => YamlModule, source?: string): YamlEngine;
/** Parse a patch-list document (top-level YAML array of patch entries). */
export declare function parseEntryList(text: string, engine: YamlEngine, label: string): unknown[];
