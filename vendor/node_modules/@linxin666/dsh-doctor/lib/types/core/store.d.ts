import type { FsLike } from './fs.ts';
export declare function readJson<T>(path: string, fallback: T): Promise<T>;
export declare function writeJsonAtomic(path: string, value: unknown, mode?: number): Promise<void>;
/** Atomically replace a JSON document through an injected filesystem. */
export declare function writeJsonAtomicFs(fs: FsLike, path: string, value: unknown): Promise<void>;
export declare function appendJsonLine(path: string, value: unknown): Promise<void>;
