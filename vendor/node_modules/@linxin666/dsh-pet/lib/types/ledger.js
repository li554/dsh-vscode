/**
 * Pet affinity economy (ledger) — composes the pure affinity and treats
 * modules with the cooldown/dedup bookkeeping and emits updated persistence
 * snapshots, marking dirty so the owning facade decides when to flush. Read
 * paths (view) no longer settle the economy; settlements happen on explicit
 * economic events: completed-turn rewards (official or legacy) and feeds.
 * @module @linxin666/dsh-pet/ledger
 */
import { applyInteraction, affinityViewOf, applyTurnReward, defaultAffinityConfig, } from "./affinity.js";
import { consumeTreat, defaultTreatConfig, settleTreatGrants, } from "./treats.js";
import { RemarkPicker } from "./remarks.js";
/**
 * Holds the current persistence snapshot and all economy bookkeeping. Every
 * mutating call flags takeDirty so the facade persists exactly once per
 * batch of changes; read methods (snapshot, affinityView) never write.
 */
export class PetLedger {
    affinityConfig;
    treatConfig;
    /** Round-robin reaction picker; rebuilt when the selected pet changes. */
    picker;
    current;
    /** Completed turns already rewarded, per session (turn numbers are per-session). */
    rewardedTurns = new Map();
    lastLegacyTurnRewardAt = 0;
    dirty = false;
    constructor(persist, config = {}) {
        this.affinityConfig = { ...defaultAffinityConfig, ...(config.affinity ?? {}) };
        this.treatConfig = { ...defaultTreatConfig, ...(config.treats ?? {}) };
        this.picker = new RemarkPicker(config.remarks);
        this.current = persist;
    }
    /** Affinity cooldown/rank tuning (read-only). */
    get affinity() {
        return this.affinityConfig;
    }
    /** The current persistence snapshot (trade a copy when mutating). */
    get snapshot() {
        return this.current;
    }
    /** Stock cap reported to clients. */
    get treatMax() {
        return this.treatConfig.maxTreats;
    }
    /** Consume the pending-write flag if any mutation occurred. */
    takeDirty() {
        const was = this.dirty;
        this.dirty = false;
        return was;
    }
    /**
     * Drop a session's rewarded-turn bookkeeping once that session is disposed,
     * so the per-session map does not grow without bound.
     */
    forgetSession(sessionId) {
        this.rewardedTurns.delete(sessionId);
    }
    /** Replace the display block (clamping stays a caller concern). */
    setDisplay(display) {
        this.current = { ...this.current, display };
        this.dirty = true;
    }
    /** Replace the selected pet id (validation stays a caller concern). */
    setPetId(petId) {
        if (this.current.petId === petId)
            return;
        this.current = { ...this.current, petId };
        this.dirty = true;
    }
    /** Replace one pet's display name (validation stays a caller concern). */
    setPetName(petId, name) {
        this.current = { ...this.current, names: { ...this.current.names, [petId]: name } };
        this.dirty = true;
    }
    /**
     * Swap the reaction pools to another pet's custom remarks (called on pet
     * selection). Slots the pet does not declare fall back to built-ins.
     */
    setRemarks(remarks) {
        this.picker = new RemarkPicker(remarks);
    }
    /**
     * Settle the treat economy (work + time output since the last settlement).
     * A zero-gain first settlement still starts the time clock (anchor write),
     * which is how the time output can ever accrue. Returns true when
     * the in-memory ledger changed and should be persisted.
     */
    settleTreats(nowMs) {
        const settlement = settleTreatGrants(this.current.treats, this.current.affinity.turns, nowMs, this.treatConfig);
        if (settlement.ledger === this.current.treats)
            return false;
        this.current = { ...this.current, treats: settlement.ledger };
        this.dirty = true;
        return true;
    }
    /**
     * Award the completed-turn reward once per session+turn (idempotent) and
     * run the treat settlement that work output feeds. Returns true when the
     * snapshot changed.
     */
    rewardTurn(sessionId, turn, nowMs) {
        const last = this.rewardedTurns.get(sessionId) ?? 0;
        if (turn <= last)
            return false;
        this.rewardedTurns.set(sessionId, turn);
        let changed = this.applyTurnReward();
        if (this.settleTreats(nowMs))
            changed = true;
        return changed;
    }
    /** Preserve turn rewards for installations that only emit legacy activity. */
    rewardLegacyTurn(nowMs) {
        // A legacy done snapshot may repeat during the celebration window.
        if (nowMs - this.lastLegacyTurnRewardAt < 5_000)
            return false;
        this.lastLegacyTurnRewardAt = nowMs;
        let changed = this.applyTurnReward();
        if (this.settleTreats(nowMs))
            changed = true;
        return changed;
    }
    applyTurnReward() {
        this.current = {
            ...this.current,
            affinity: applyTurnReward(this.current.affinity, this.affinityConfig),
        };
        this.dirty = true;
        return true;
    }
    /**
     * Pet or feed the pet. Feeding settles first, then gates on the feed
     * cooldown before spending stock — a feed inside the cooldown must not burn
     * a treat for nothing.
     */
    interact(kind, nowMs) {
        if (kind === 'feed')
            this.settleTreats(nowMs);
        const before = this.current.affinity;
        const outcome = applyInteraction(before, kind, nowMs, this.affinityConfig);
        // Reactions come from the picker pools (custom per-pet slots override
        // the built-in library per slot); outcome.reaction stays the fallback
        // copy for direct applyInteraction callers.
        if (kind === 'feed' && !outcome.accepted) {
            this.current = { ...this.current, affinity: outcome.affinity };
            this.dirty = true;
            return {
                reaction: this.picker.pickAt('feedCooldown', before.feedRejects),
                delta: 0,
                affinity: this.affinityView(nowMs),
            };
        }
        if (kind === 'feed') {
            const consume = consumeTreat(this.current.treats);
            if (!consume.ok) {
                return {
                    reaction: this.picker.pick('noTreats'),
                    delta: 0,
                    affinity: this.affinityView(nowMs),
                };
            }
            this.current = { ...this.current, treats: consume.ledger };
            this.dirty = true;
        }
        this.current = { ...this.current, affinity: outcome.affinity };
        this.dirty = true;
        const count = kind === 'pet'
            ? outcome.accepted ? before.pets : before.petRejects
            : before.feeds;
        return {
            reaction: this.picker.pickAt(outcome.accepted ? kind : 'petCooldown', count),
            delta: outcome.delta,
            affinity: this.affinityView(nowMs),
        };
    }
    /** Current affinity view for the RPC snapshot. */
    affinityView(nowMs) {
        return affinityViewOf(this.current.affinity, nowMs, this.affinityConfig);
    }
}
