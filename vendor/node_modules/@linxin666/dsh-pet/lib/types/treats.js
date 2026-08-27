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
export const defaultTreatConfig = {
    turnsPerTreat: 30,
    timeTreatMs: 300 * 60_000,
    maxTreats: 20,
};
export function emptyTreatLedger() {
    return { treats: 0, lastTreatGrantAt: 0, turnsAtLastTreatGrant: 0 };
}
function cap(treats, max) {
    return Math.min(max, Math.max(0, treats));
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
export function settleTreatGrants(ledger, turns, nowMs, config = defaultTreatConfig) {
    const turnDelta = Math.max(0, turns - ledger.turnsAtLastTreatGrant);
    const workGrants = Math.floor(turnDelta / config.turnsPerTreat);
    // The time clock starts at the first settlement (no backfill of pre-first
    // idle history); thereafter only time grants move it forward.
    const timeAnchor = ledger.lastTreatGrantAt === 0 ? nowMs : ledger.lastTreatGrantAt;
    const timeGrants = Math.floor(Math.max(0, nowMs - timeAnchor) / config.timeTreatMs);
    const gained = workGrants + timeGrants;
    if (gained <= 0) {
        if (ledger.lastTreatGrantAt === 0) {
            // Zero-gain first settlement: persist the clock start anyway, so the
            // 30-minute time output can begin. Before this fix the anchor stayed 0
            // forever (the deadlock: no grant means no anchor write means no grant).
            return { ledger: { ...ledger, lastTreatGrantAt: nowMs }, gained: 0 };
        }
        return { ledger, gained: 0 };
    }
    return {
        ledger: {
            treats: cap(ledger.treats + gained, config.maxTreats),
            lastTreatGrantAt: timeGrants > 0
                ? timeAnchor + timeGrants * config.timeTreatMs
                : timeAnchor,
            turnsAtLastTreatGrant: workGrants > 0
                ? turns - (turnDelta % config.turnsPerTreat)
                : ledger.turnsAtLastTreatGrant,
        },
        gained,
    };
}
/**
 * Consume one treat for a feed. Returns the outcome; a feed with no stocked
 * treats is refused.
 */
export function consumeTreat(ledger) {
    if (ledger.treats <= 0)
        return { ok: false };
    return { ok: true, ledger: { ...ledger, treats: ledger.treats - 1 } };
}
