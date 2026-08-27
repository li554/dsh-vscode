/**
 * Pet remark (reaction copy) library — pure. Reaction bubbles the pet speaks
 * on interaction events come from two layers:
 *  - the built-in default library below (a generous pool per event kind);
 *  - per-pet custom lines declared in a manifest's 'remarks' block, which
 *    community pet contributions (PRs) use to give their pet its own voice.
 * A custom slot replaces the built-in pool for that slot only; the other
 * slots keep the built-in lines. Picks cycle round-robin within a pool so
 * repeated interactions stay varied while tests stay deterministic (no
 * randomness, no clock).
 * @module @linxin666/dsh-pet/remarks
 */
/** Interaction events a reaction line can accompany. */
export type RemarkKind = 'pet' | 'petCooldown' | 'feed' | 'feedCooldown' | 'noTreats';
/** Every remark slot, in a stable order. */
export declare const REMARK_KINDS: readonly RemarkKind[];
/** Per-pet remark overrides (normalized shape; each slot is a line pool). */
export type PetRemarks = Partial<Record<RemarkKind, string[]>>;
/** Raw manifest shape: each slot accepts one line or a pool of lines. */
export type PetRemarksManifest = Partial<Record<RemarkKind, string | string[]>>;
/** Longest accepted reaction line (characters, trimmed before slicing). */
export declare const REMARK_LINE_MAX = 120;
/** Longest accepted pool per slot. */
export declare const REMARK_LINES_MAX = 64;
/**
 * Built-in default remark library. Every pool is plain zh copy in the
 * whale-girl voice; the first line of each pool is the legacy reaction the
 * plugin has always spoken, so existing installs and tests keep their
 * wording while the pool adds variety. No emoji characters anywhere (the
 * repo bans them); ～ is the whale-girl's signature.
 */
export declare const BUILTIN_REMARKS: Readonly<Record<RemarkKind, readonly string[]>>;
/** The legacy first line of one kind (direct callers' fallback copy). */
export declare function builtinRemark(kind: RemarkKind): string;
/**
 * Normalize a manifest 'remarks' block into per-kind line pools. Unknown
 * slots and non-string entries are skipped with a warning; empty pools are
 * dropped so the built-in library takes the slot. Returns undefined when no
 * usable slot remains.
 */
export declare function normalizePetRemarks(raw: unknown, onWarning?: (message: string) => void): PetRemarks | undefined;
/**
 * Round-robin reaction picker over the effective pools (per-pet custom lines
 * override the built-in pool per slot). Counters are per slot, so each slot
 * cycles its own list independently and picks stay deterministic for tests.
 */
export declare class RemarkPicker {
    private readonly counters;
    private readonly pools;
    constructor(overrides?: PetRemarks);
    /** The effective pool for one slot (custom override or built-in). */
    pool(kind: RemarkKind): readonly string[];
    /** The next line for one slot (round-robin within its pool). */
    pick(kind: RemarkKind): string;
    /** Select a line from a stable external counter without changing local picker state. */
    pickAt(kind: RemarkKind, count: number): string;
}
//# sourceMappingURL=remarks.d.ts.map