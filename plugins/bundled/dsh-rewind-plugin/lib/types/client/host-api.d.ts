/**
 * The browser half of the two read-only host queries: the mode popover's impact
 * preview and the `/rewind` candidate list, posted to their exact `/api` routes.
 *
 * @module dsh-rewind/client/host-api
 */
import type { RewindCandidate } from './candidates.ts';
/** One file affected by a rewind. */
export interface PreviewFileImpact {
    readonly path: string;
    readonly action: 'restore' | 'delete';
}
/** One impact probe resolved, failed, or timed out (`null`). */
export type PreviewOutcome = {
    readonly kind: 'success';
    readonly files: readonly PreviewFileImpact[];
    readonly backupOff: boolean;
} | {
    readonly kind: 'error';
    readonly text: string;
} | null;
/** Fetch one target's impact through the host query route. */
export type PreviewCall = (sessionId: string, seq: number) => Promise<PreviewOutcome>;
/** Resolve one target's file impact through the host query route. */
export declare function previewOverApi(sessionId: string, seq: number): Promise<PreviewOutcome>;
/** Fetch the full rewind candidate list through the host query route. */
export declare function candidatesOverApi(sessionId: string): Promise<readonly RewindCandidate[] | undefined>;
