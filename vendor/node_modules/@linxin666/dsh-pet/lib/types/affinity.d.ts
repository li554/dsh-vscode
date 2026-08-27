/**
 * Affinity score — pure, clock-injected. The pet grows closer the more you
 * work together and care for it: every completed turn earns a small reward,
 * petting earns a tiny one (cooldown-gated), feeding earns the most.
 * Persistence lives in the service; this module only computes transitions.
 * Reaction copy resolves from the shared remark library (first line of each
 * built-in pool); the ledger layers per-pet custom remarks on top.
 * @module @linxin666/dsh-pet/affinity
 */
/** One interaction the user can perform on the pet. */
export type PetInteraction = 'pet' | 'feed';
/** Affinity state as persisted. */
export interface AffinityState {
    /** Total affinity points, capped at AFFINITY_MAX. */
    points: number;
    /** Epoch ms of the last pet interaction. */
    lastPetAt: number;
    /** Epoch ms of the last feed. */
    lastFeedAt: number;
    /** Total pet count (lifetime). */
    pets: number;
    /** Total feed count (lifetime). */
    feeds: number;
    /** Total pet attempts rejected by cooldown (lifetime). */
    petRejects: number;
    /** Total feed attempts rejected by cooldown (lifetime). */
    feedRejects: number;
    /** Total completed turns witnessed (lifetime). */
    turns: number;
}
/**
 * Affinity points cap. Historically 100; removed so long-term companions
 * keep growing — the default limit is now the full 999,999,999 range.
 */
export declare const AFFINITY_MAX = 999999999;
/** Affinity ranks by points; the pet visibly grows with its rank.
 *  The original four tiers (0/25/50/80) are unchanged; higher tiers reach
 *  into the extended cap so the ladder stays meaningful for veteran
 *  companions. Marker glyphs are plain ASCII (the repo bans all emoji
 *  characters); they read as a growing star trail alongside the rank name. */
export declare const AFFINITY_RANKS: readonly [{
    readonly min: 0;
    readonly name: "幼鲸";
    readonly emoji: "*";
}, {
    readonly min: 25;
    readonly name: "伙伴";
    readonly emoji: "**";
}, {
    readonly min: 50;
    readonly name: "挚友";
    readonly emoji: "***";
}, {
    readonly min: 80;
    readonly name: "深海羁绊";
    readonly emoji: "****";
}, {
    readonly min: 200;
    readonly name: "心有灵犀";
    readonly emoji: "*****";
}, {
    readonly min: 500;
    readonly name: "传说羁绊";
    readonly emoji: "******";
}, {
    readonly min: 2000;
    readonly name: "神话羁绊";
    readonly emoji: "*******";
}, {
    readonly min: 10000;
    readonly name: "永恒之契";
    readonly emoji: "********";
}, {
    readonly min: 100000;
    readonly name: "鲸生共渡";
    readonly emoji: "*********";
}];
/** Interaction tuning (all in points / ms). */
export interface AffinityConfig {
    /** Points per completed turn. */
    turnReward: number;
    /** Points per pet; applied only outside the pet cooldown. */
    petReward: number;
    /** Cooldown between pets, ms. */
    petCooldownMs: number;
    /** Points per feed. */
    feedReward: number;
    /** Cooldown between feeds, ms. */
    feedCooldownMs: number;
}
export declare const defaultAffinityConfig: AffinityConfig;
export declare function emptyAffinity(): AffinityState;
/** Outcome of one interaction. */
export interface InteractionOutcome {
    /** Mutated affinity state (caller persists it). */
    affinity: AffinityState;
    /** Points actually gained (0 when inside the cooldown). */
    delta: number;
    /** Human-readable reaction copy the UI shows as a bubble. */
    reaction: string;
    /** True when the interaction was accepted (outside cooldown). */
    accepted: boolean;
}
/** Rank for a point total. */
export declare function rankOf(points: number): (typeof AFFINITY_RANKS)[number];
/** Read-only affinity snapshot suited for the RPC view shape. */
export interface PetAffinityView {
    points: number;
    rank: string;
    rankEmoji: string;
    pets: number;
    feeds: number;
    turns: number;
    /** True while the pet interaction is inside its cooldown. */
    petCooldown: boolean;
    /** True while the feed is inside its cooldown. */
    feedCooldown: boolean;
}
/** Derive the read-only view of one affinity state at a wall-clock instant. */
export declare function affinityViewOf(state: AffinityState, nowMs: number, config?: AffinityConfig): PetAffinityView;
/**
 * Apply one interaction to a copy of the state (immutable style: returns a
 * new object; the caller replaces the persisted state). Cooldowns only
 * apply once the pet has been interacted with at least once (last*At === 0
 * means "never", so the first pet/feed always lands).
 */
export declare function applyInteraction(state: AffinityState, kind: PetInteraction, nowMs: number, config?: AffinityConfig): InteractionOutcome;
/** Reward one completed turn (called by the host on `done`). */
export declare function applyTurnReward(state: AffinityState, config?: AffinityConfig): AffinityState;
//# sourceMappingURL=affinity.d.ts.map