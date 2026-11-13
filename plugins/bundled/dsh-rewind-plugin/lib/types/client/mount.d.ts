/**
 * A2 element-tree mount: one extra action inside the official user/steering
 * message rows.
 *
 * The actions row is built by the official renderer, so the action can only be
 * added while that row is constructed. The mount takes over the slot entry's
 * component identity, calls the official renderer with the props the slot
 * composed for it, and replaces the row element's `actions` constructor: the
 * official constructor runs first, and the actions row it returns receives the
 * extra action through its `extraActions` prop.
 *
 * Both element types (the row and the actions row) are preserved, so React
 * reuses their fibers, and every prop this module does not touch is passed
 * through unchanged. The action becomes a child of the actions row, so it
 * mounts, unmounts and inherits the row's visibility with the Copy button
 * instead of chasing the DOM.
 *
 * Any shape mismatch returns the official element as-is: the worst outcome is a
 * missing action, never a broken row.
 *
 * @module dsh-rewind/client/mount
 */
import { type ReactNode } from 'react';
/** One rendered row the action is offered for. */
export interface RowAction {
    /** Session rendering the row. */
    readonly sessionId: string;
    /** Durable log seq of the message. */
    readonly seq: number;
    /** Message time, epoch ms. */
    readonly time: number;
    /** The row's joined text — the Copy target, known only when the actions row is built. */
    readonly text: string;
}
/** Build the action element for one row; `null` leaves the actions row untouched. */
export type RowActionRenderer = (row: RowAction) => ReactNode;
/** A registered slot entry, as the live ledger exposes it. */
interface LedgerEntry {
    /** The registered component identity; replacing it replaces what the row renders. */
    component: unknown;
    readonly options: {
        readonly key?: string;
        readonly priority?: number;
    };
}
/** The live slot-ledger surface the mount reads. */
export interface SlotLedger {
    /** Entries of one slot key, in registration order. */
    entries?(key: string): readonly LedgerEntry[];
    /** Registration changes of one slot key (microtask-batched). */
    subscribe?(key: string, fn: () => void): () => void;
    /** Registration path, used only for the version tick. */
    register?(options: {
        readonly name: string;
        readonly key?: string;
    }, component: () => null): () => void;
}
/** Mount inputs. */
export interface RowActionMount {
    readonly slots: SlotLedger;
    readonly render: RowActionRenderer;
}
/**
 * Take over the user/steering row components so every rendered row's actions row
 * carries `render`'s element.
 *
 * Ledger methods are always called on `slots` itself: the live service is a
 * proxy that re-binds the caller context per call, so a method detached into a
 * local would lose its `this`.
 *
 * Wrapping runs synchronously with the registration (and at install for entries
 * already registered), so a row's first render already sees the new identity.
 * Outlets re-read an identity only on a registration change, so an already
 * rendered row is nudged once (see `tick`).
 *
 * @param mount - ledger surface and action renderer.
 * @returns teardown restoring the taken-over component identities.
 */
export declare function installRowAction({ slots, render }: RowActionMount): () => void;
export {};
