/**
 * Pet affinity economy (ledger) — composes the pure affinity and treats
 * modules with the cooldown/dedup bookkeeping and emits updated persistence
 * snapshots, marking dirty so the owning facade decides when to flush. Read
 * paths (view) no longer settle the economy; settlements happen on explicit
 * economic events: completed-turn rewards (official or legacy) and feeds.
 * @module @linxin666/dsh-pet/ledger
 */
import { type AffinityConfig, type PetAffinityView, type PetInteraction } from './affinity.ts';
import { type TreatConfig } from './treats.ts';
import { type PetRemarks } from './remarks.ts';
import type { PetDisplayConfig, PetPersist } from './persist.ts';
/** Tuning overrides for the affinity economy. */
export interface LedgerConfig {
    affinity?: Partial<AffinityConfig>;
    treats?: Partial<TreatConfig>;
    /** Per-pet remark pools for the selected pet (custom slots override built-ins). */
    remarks?: PetRemarks;
}
/** Result of one ledger interaction (the shape the pet RPC returns). */
export interface LedgerInteractionResult {
    /** Reaction copy bubble. */
    reaction: string;
    /** Points gained (0 when inside the cooldown). */
    delta: number;
    /** Full affinity snapshot (same shape as the state view). */
    affinity: PetAffinityView;
}
/**
 * Holds the current persistence snapshot and all economy bookkeeping. Every
 * mutating call flags takeDirty so the facade persists exactly once per
 * batch of changes; read methods (snapshot, affinityView) never write.
 */
export declare class PetLedger {
    private readonly affinityConfig;
    private readonly treatConfig;
    /** Round-robin reaction picker; rebuilt when the selected pet changes. */
    private picker;
    private current;
    /** Completed turns already rewarded, per session (turn numbers are per-session). */
    private rewardedTurns;
    private lastLegacyTurnRewardAt;
    private dirty;
    constructor(persist: PetPersist, config?: LedgerConfig);
    /** Affinity cooldown/rank tuning (read-only). */
    get affinity(): AffinityConfig;
    /** The current persistence snapshot (trade a copy when mutating). */
    get snapshot(): PetPersist;
    /** Stock cap reported to clients. */
    get treatMax(): number;
    /** Consume the pending-write flag if any mutation occurred. */
    takeDirty(): boolean;
    /**
     * Drop a session's rewarded-turn bookkeeping once that session is disposed,
     * so the per-session map does not grow without bound.
     */
    forgetSession(sessionId: string): void;
    /** Replace the display block (clamping stays a caller concern). */
    setDisplay(display: PetDisplayConfig): void;
    /** Replace the selected pet id (validation stays a caller concern). */
    setPetId(petId: string): void;
    /** Replace one pet's display name (validation stays a caller concern). */
    setPetName(petId: string, name: string): void;
    /**
     * Swap the reaction pools to another pet's custom remarks (called on pet
     * selection). Slots the pet does not declare fall back to built-ins.
     */
    setRemarks(remarks?: PetRemarks): void;
    /**
     * Settle the treat economy (work + time output since the last settlement).
     * A zero-gain first settlement still starts the time clock (anchor write),
     * which is how the time output can ever accrue. Returns true when
     * the in-memory ledger changed and should be persisted.
     */
    settleTreats(nowMs: number): boolean;
    /**
     * Award the completed-turn reward once per session+turn (idempotent) and
     * run the treat settlement that work output feeds. Returns true when the
     * snapshot changed.
     */
    rewardTurn(sessionId: string, turn: number, nowMs: number): boolean;
    /** Preserve turn rewards for installations that only emit legacy activity. */
    rewardLegacyTurn(nowMs: number): boolean;
    private applyTurnReward;
    /**
     * Pet or feed the pet. Feeding settles first, then gates on the feed
     * cooldown before spending stock — a feed inside the cooldown must not burn
     * a treat for nothing.
     */
    interact(kind: PetInteraction, nowMs: number): LedgerInteractionResult;
    /** Current affinity view for the RPC snapshot. */
    affinityView(nowMs: number): PetAffinityView;
}
//# sourceMappingURL=ledger.d.ts.map