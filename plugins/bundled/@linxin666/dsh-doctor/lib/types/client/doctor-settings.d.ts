/**
 * Settings-namespace facade for the doctor enable switch.
 *
 * Wraps the bound SettingsScope in a never-throwing view: a missing namespace,
 * a memory-mode scope or a hostile scope degrades to an 'unavailable' state
 * instead of breaking the console. The facade also routes a failed write back
 * as a result value instead of a rejection.
 * @module @linxin666/dsh-doctor/client
 */
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { DoctorSettings } from './doctor-types.ts';
/** Read state of the enable switch. */
export interface DoctorSettingsState {
    status: 'loading' | 'ready' | 'unavailable';
    /** Resolved enabled flag; undefined before ready or when absent (treated on). */
    enabled: boolean | undefined;
    /** Whether the host document accepts writes right now. */
    writable: boolean;
}
/** Settled result of one toggle write (never a rejection). */
export type DoctorSettingsWrite = {
    ok: true;
} | {
    ok: false;
    error: string;
};
/** Never-throwing facade over the bound settings scope. */
export interface DoctorSettingsHandle {
    /** Read the current derived state (never throws). */
    getState(): DoctorSettingsState;
    /** Subscribe to scope snapshot replacements (never throws). */
    listen(listener: () => void): () => void;
    /** Persist the enabled flag (never rejects). */
    setEnabled(enabled: boolean): Promise<DoctorSettingsWrite>;
}
/** Build a handle, or null when no scope is available (host half absent). */
export declare function createDoctorSettingsHandle(scope: SettingsScope<DoctorSettings> | undefined | null): DoctorSettingsHandle | null;
