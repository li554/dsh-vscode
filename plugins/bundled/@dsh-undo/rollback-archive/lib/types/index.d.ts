/**
 * Session archive capability (standalone plugin): the one owner of archive
 * listing, read-only viewing, and tombstone hiding. Restoration and permanent
 * deletion are intentionally absent — dsh publishes no unarchive or
 * delete/removeImage API, so this plugin degrades those original-spec
 * operations to a plugin-owned tombstone list.
 * @module @dsh-undo/rollback-archive
 */
import { Context, Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import type { SessionId } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ArchivedSessionReadValue, SessionArchiveDeleteAllValue, SessionArchiveListValue, SessionArchiveMutationValue, SessionArchiveResult, SessionArchiveSessionRequest } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Provider-owned archive lifecycle capability. */
        sessionArchive: SessionArchiveService;
    }
}
/** Service Definition for the Host-global Session archive collection. */
export interface SessionArchiveService {
    /** Add one durable Session to the global archive set.
     * @param sessionId - Durable Session to hide globally.
     * @returns Resolution after archive membership is durable.
     */
    archive(sessionId: SessionId): Promise<void>;
    /** Hide one archived Session from the archive task list without touching its log.
     * @param sessionId - Archived Session to tombstone.
     * @returns Mutation result; absent memberships resolve without writing.
     */
    tombstone(sessionId: SessionId): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Reveal one tombstoned Session in the archive task list again.
     * @param sessionId - Tombstoned Session to reveal.
     * @returns Mutation result; absent tombstones resolve without writing.
     */
    untombstone(sessionId: SessionId): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Whether one Session is currently tombstoned by this plugin.
     * @param sessionId - Session to test.
     * @returns Whether the Session is hidden from the archive task list.
     */
    isTombstoned(sessionId: SessionId): boolean;
}
/** Deployment-owned directory for durable archive metadata. */
export interface Config {
    /** Absolute application-data root owned exclusively by this plugin. */
    readonly root: string;
}
/** Host Provider for the global archive set and the plugin-owned tombstone list. */
export declare class DefaultSessionArchiveService extends TypertRemoteService implements SessionArchiveService {
    static inject: string[];
    static Config: s<Config>;
    private readonly archiveTimes;
    private readonly archiveTimesPath;
    private readonly tombstones;
    private readonly tombstonesPath;
    constructor(ctx: Context, config: Config);
    /** Load archive timestamps and tombstones before serving the archive collection. */
    protected [Service.init](): Promise<void>;
    /** Add one Session to the Host archive set. */
    archive(sessionId: SessionId): Promise<void>;
    /** Hide one archived Session from the archive task list without touching its log. */
    tombstone(sessionId: SessionId): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Reveal one tombstoned Session in the archive task list again. */
    untombstone(sessionId: SessionId): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Restore one archived conversation as a new visible Session without touching its log.
     * @param request - Archived Session to restore.
     * @returns The replacement Session or a business refusal.
     */
    restore(request: SessionArchiveSessionRequest): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Permanently delete an archived Session's log files and hide it from the task list.
     * @param request - Archived Session to erase.
     * @returns Permanent-deletion mutation result.
     */
    delete(request: SessionArchiveSessionRequest): Promise<SessionArchiveResult<SessionArchiveMutationValue>>;
    /** Permanently delete every non-tombstoned archived Session.
     * @returns Per-Session outcomes; individual refusals do not stop the sweep.
     */
    deleteAll(): Promise<SessionArchiveDeleteAllValue>;
    /** Whether one Session is currently hidden from the archive task list. */
    isTombstoned(sessionId: SessionId): boolean;
    /** List the Host archive set with persisted metadata for the archive task UI.
     * @returns Archive metadata for every currently archived, non-tombstoned Session.
     */
    list(): Promise<SessionArchiveListValue>;
    /** Read one archived Session without making it visible to ordinary navigation.
     * @param request - Archived Session to read.
     * @returns Text transcript and metadata without navigation changes.
     */
    read(request: SessionArchiveSessionRequest): Promise<SessionArchiveResult<ArchivedSessionReadValue>>;
    /** Combine persisted and live headers; live identities win over a stale durable listing. */
    private headers;
    /** Read the authoritative event list regardless of whether the Session is currently loaded. */
    private events;
    /** Change one timestamp and persist the complete plugin-owned document. */
    private setArchiveTime;
    /** Persist the complete tombstone document. */
    private writeTombstones;
    /** Load one optional plugin-owned document. */
    private loadDocument;
    /** Atomically replace one plugin-owned JSON document. */
    private writeDocument;
    /** Make one immutable success result. */
    private success;
    /** Make one expected archive-task refusal. */
    private failure;
}
export default DefaultSessionArchiveService;
//# sourceMappingURL=index.d.ts.map