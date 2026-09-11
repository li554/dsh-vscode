/** Archive Tasks Settings page (standalone plugin edition). */
import { type ReactNode } from 'react';
import type { ArchivedSessionItem, ArchivedSessionReadValue, SessionArchiveListValue } from '@dsh-undo/rollback-archive/types';
import type { ConversationArchiveActionValue } from '@dsh-undo/rollback-undo/types';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Remote actions used by the Archive Tasks page. */
export interface ArchiveSettingsInjected {
    /** Read every archived Session currently hidden from ordinary navigation. */
    list: () => Promise<SessionArchiveListValue>;
    /** Load one archived conversation for an in-place read-only viewer. */
    read: (sessionId: ArchivedSessionItem['sessionId']) => Promise<ArchiveTaskReadResult>;
    /** Restore one archived conversation as a new visible Session. */
    restore: (sessionId: ArchivedSessionItem['sessionId']) => Promise<ArchiveTaskResult>;
    /** Permanently delete one archived Session's log files and hide it from this list. */
    delete: (sessionId: ArchivedSessionItem['sessionId']) => Promise<ArchiveTaskResult>;
    /** Permanently delete every archived Session, reporting per-Session outcomes. */
    deleteAll: () => Promise<ArchiveDeleteAllResult>;
    /** Select the recovery state for one archived Session. */
    archiveAction: (sessionId: ArchivedSessionItem['sessionId']) => Promise<ConversationArchiveActionValue>;
}
/** One browser-normalized completion from the archive capability. */
export type ArchiveTaskResult = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly message: string;
};
/** Bulk-deletion completion with per-Session outcome counts. */
export type ArchiveDeleteAllResult = {
    readonly ok: true;
    readonly deleted: number;
    readonly failed: number;
} | {
    readonly ok: false;
    readonly message: string;
};
/** Browser-normalized archived conversation response. */
export type ArchiveTaskReadResult = {
    readonly ok: true;
    readonly value: ArchivedSessionReadValue;
} | {
    readonly ok: false;
    readonly message: string;
};
/** Full page props assembled by the Settings slot renderer. */
export type ArchiveSettingsProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.archive'> & InjectFace<ArchiveSettingsInjected>;
/** Render the archive list, its read-only viewer, and restore/permanent-delete actions. */
export declare function ArchiveSettingsSection(props: Partial<ArchiveSettingsProps>): ReactNode;
//# sourceMappingURL=ArchiveSettingsSection.d.ts.map