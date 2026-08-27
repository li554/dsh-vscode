/**
 * Treat (小鱼干) economy — pure, clock-injected. The pet's food comes from
 * two sources, both tied to companionship:
 *  - work output: every N completed turns grant one treat;
 *  - time output: every T minutes of wall-clock time grant one treat.
 * Difficulty tuned deliberately high (10x the original cadence): treats are
 * a rare delicacy the pet earns through sustained companionship, not a
 * routine drop.
 * Feeding consumes one treat. Settlement is lazy: it runs whenever the host
 * serves a state snapshot or an interaction, so there is no timer and no
 * drift — elapsed periods are computed from the persisted last-grant marks.
 * @module @linxin666/dsh-pet/treats
 */
/** Treat economy tuning. */
export interface TreatConfig {
    /** Completed turns per work-output treat. */
    turnsPerTreat: number;
    /** Wall-clock ms per time-output treat. */
    timeTreatMs: number;
    /** Hard cap on stocked treats. */
    maxTreats: number;
}
export declare const defaultTreatConfig: TreatConfig;
/** Treat ledger as persisted inside PetPersist. */
export interface TreatLedger {
    /** Current stocked treats (0..maxTreats). */
    treats: number;
    /** Time-output anchor: epoch ms the wall-clock treat clock last advanced (0 = never started). */
    lastTreatGrantAt: number;
    /** Work-output anchor: affinity turns counter at the last work-out settle. */
    turnsAtLastTreatGrant: number;
}
export declare function emptyTreatLedger(): TreatLedger;
/** Outcome of one settlement pass. */
export interface TreatSettlement {
    /** Mutated ledger (caller persists it). */
    ledger: TreatLedger;
    /** Treats gained in this pass (work + time). */
    gained: number;
}
/**
 * Settle treat grants from both sources against one ledger snapshot.
 * Work output counts whole periods since the last work settlement
 * (turnsDelta / turnsPerTreat) and advances only the work anchor;
 * time output counts whole periods since the time anchor
 * (`lastTreatGrantAt`) and advances only the time anchor. The two sources
 * are independent so a continuously working user still earns time treats.
 * 0 time history never backfills — the clock starts at the first settlement,
 * and even a zero-gain first settlement writes the time anchor so the next
 * elapsed period can accrue (anchor deadlock fix). Both sources are clamped
 * by the stock cap. When the anchor is already set and nothing is due, the
 * input ledger is returned unchanged (same object), so callers can skip
 * persistence cheaply.
 */
export declare function settleTreatGrants(ledger: TreatLedger, turns: number, nowMs: number, config?: TreatConfig): TreatSettlement;
/**
 * Consume one treat for a feed. Returns the outcome; a feed with no stocked
 * treats is refused.
 */
export declare function consumeTreat(ledger: TreatLedger): {
    ok: true;
    ledger: TreatLedger;
} | {
    ok: false;
};
//# sourceMappingURL=treats.d.ts.map