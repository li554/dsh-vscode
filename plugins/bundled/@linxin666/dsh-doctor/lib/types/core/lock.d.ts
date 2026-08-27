import type { FsLike } from './fs.ts';
import type { LockScope, LockState } from './types.ts';
export declare class LockError extends Error {
    readonly code: 'LOCK_HELD' | 'LOCK_STALE' | 'LOCK_LOST' | 'LOCK_ERROR';
    readonly scope: LockScope;
    readonly key: string;
    constructor(code: 'LOCK_HELD' | 'LOCK_STALE' | 'LOCK_LOST' | 'LOCK_ERROR', scope: LockScope, key: string, detail: string);
}
export interface LockManagerDeps {
    fs: FsLike;
    home: string;
    /** Process id recorded in the token; defaults to 0 (tests). */
    pid?: number;
    /** Host name recorded in the token; defaults to 'local'. */
    host?: string;
    /** Milliseconds clock for heartbeat and staleness checks. */
    clock(): number;
    /** ISO timestamp for token.startedAt. */
    iso(): string;
    /** Alive probe for stale detection; defaults to 'always dead'. */
    pidAlive?(pid: number): boolean;
    /** Sleep injection for polling loops; defaults to a real timer. */
    sleep?(ms: number): Promise<void>;
}
export interface AcquireOptions {
    intent: string;
    timeoutMs?: number;
    staleMs?: number;
    heartbeatMs?: number;
}
export interface LockHandle {
    readonly scope: LockScope;
    readonly key: string;
    readonly path: string;
    release(): Promise<void>;
    touch(now: number): Promise<void>;
}
export interface LockManager {
    acquire(scope: LockScope, profile: string | undefined, options: AcquireOptions): Promise<LockHandle>;
    status(scope: LockScope, profile: string | undefined): Promise<LockState>;
    release(handle: LockHandle): Promise<void>;
}
/** Create a lock manager rooted under the capsule locks dir. */
export declare function createLockManager(deps: LockManagerDeps): LockManager;
