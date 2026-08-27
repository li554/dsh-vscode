/**
 * Affinity score — pure, clock-injected. The pet grows closer the more you
 * work together and care for it: every completed turn earns a small reward,
 * petting earns a tiny one (cooldown-gated), feeding earns the most.
 * Persistence lives in the service; this module only computes transitions.
 * Reaction copy resolves from the shared remark library (first line of each
 * built-in pool); the ledger layers per-pet custom remarks on top.
 * @module @linxin666/dsh-pet/affinity
 */
import { BUILTIN_REMARKS, builtinRemark } from "./remarks.js";
/**
 * Affinity points cap. Historically 100; removed so long-term companions
 * keep growing — the default limit is now the full 999,999,999 range.
 */
export const AFFINITY_MAX = 999_999_999;
/** Affinity ranks by points; the pet visibly grows with its rank.
 *  The original four tiers (0/25/50/80) are unchanged; higher tiers reach
 *  into the extended cap so the ladder stays meaningful for veteran
 *  companions. Marker glyphs are plain ASCII (the repo bans all emoji
 *  characters); they read as a growing star trail alongside the rank name. */
export const AFFINITY_RANKS = [
    { min: 0, name: '幼鲸', emoji: '*' },
    { min: 25, name: '伙伴', emoji: '**' },
    { min: 50, name: '挚友', emoji: '***' },
    { min: 80, name: '深海羁绊', emoji: '****' },
    { min: 200, name: '心有灵犀', emoji: '*****' },
    { min: 500, name: '传说羁绊', emoji: '******' },
    { min: 2_000, name: '神话羁绊', emoji: '*******' },
    { min: 10_000, name: '永恒之契', emoji: '********' },
    { min: 100_000, name: '鲸生共渡', emoji: '*********' },
];
export const defaultAffinityConfig = {
    turnReward: 1,
    petReward: 1,
    petCooldownMs: 10_000,
    feedReward: 5,
    feedCooldownMs: 30_000,
};
export function emptyAffinity() {
    return {
        points: 0,
        lastPetAt: 0,
        lastFeedAt: 0,
        pets: 0,
        feeds: 0,
        petRejects: 0,
        feedRejects: 0,
        turns: 0,
    };
}
/** Rank for a point total. */
export function rankOf(points) {
    let rank = AFFINITY_RANKS[0];
    for (const candidate of AFFINITY_RANKS) {
        if (points >= candidate.min)
            rank = candidate;
    }
    return rank;
}
/** Derive the read-only view of one affinity state at a wall-clock instant. */
export function affinityViewOf(state, nowMs, config = defaultAffinityConfig) {
    const rank = rankOf(state.points);
    return {
        points: state.points,
        rank: rank.name,
        rankEmoji: rank.emoji,
        pets: state.pets,
        feeds: state.feeds,
        turns: state.turns,
        petCooldown: nowMs - state.lastPetAt < config.petCooldownMs,
        feedCooldown: nowMs - state.lastFeedAt < config.feedCooldownMs,
    };
}
function clamp(points) {
    return Math.min(AFFINITY_MAX, Math.max(0, points));
}
/** Built-in reaction selected deterministically from a persisted counter. */
function countedRemark(kind, count) {
    const pool = BUILTIN_REMARKS[kind];
    return pool[Math.max(0, Math.floor(count)) % pool.length] ?? builtinRemark(kind);
}
/**
 * Apply one interaction to a copy of the state (immutable style: returns a
 * new object; the caller replaces the persisted state). Cooldowns only
 * apply once the pet has been interacted with at least once (last*At === 0
 * means "never", so the first pet/feed always lands).
 */
export function applyInteraction(state, kind, nowMs, config = defaultAffinityConfig) {
    const next = { ...state };
    if (kind === 'pet') {
        if (state.lastPetAt !== 0 && nowMs - state.lastPetAt < config.petCooldownMs) {
            next.petRejects += 1;
            return {
                affinity: next,
                delta: 0,
                reaction: countedRemark('petCooldown', state.petRejects),
                accepted: false,
            };
        }
        next.lastPetAt = nowMs;
        next.pets += 1;
        next.points = clamp(state.points + config.petReward);
        return {
            affinity: next,
            delta: config.petReward,
            reaction: countedRemark('pet', state.pets),
            accepted: true,
        };
    }
    if (kind === 'feed') {
        if (state.lastFeedAt !== 0 && nowMs - state.lastFeedAt < config.feedCooldownMs) {
            next.feedRejects += 1;
            return {
                affinity: next,
                delta: 0,
                reaction: countedRemark('feedCooldown', state.feedRejects),
                accepted: false,
            };
        }
        next.lastFeedAt = nowMs;
        next.feeds += 1;
        next.points = clamp(state.points + config.feedReward);
        return {
            affinity: next,
            delta: config.feedReward,
            reaction: countedRemark('feed', state.feeds),
            accepted: true,
        };
    }
    return { affinity: state, delta: 0, reaction: '', accepted: false };
}
/** Reward one completed turn (called by the host on `done`). */
export function applyTurnReward(state, config = defaultAffinityConfig) {
    const next = { ...state };
    next.turns += 1;
    next.points = clamp(state.points + config.turnReward);
    return next;
}
