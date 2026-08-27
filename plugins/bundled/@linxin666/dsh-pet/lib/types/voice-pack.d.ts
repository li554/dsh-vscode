/**
 * Voice-pack normalization and merge (pet-center M4, issue #677).
 *
 * A voice pack is the optional 'voice.json' inside a pet directory, or the
 * global '$DSH_HOME/pets/.voice.json' override file — pure JSON content that
 * layers pet copy over the built-in pools. Two halves:
 *
 *  - 'overrides': the chatter pools (status / tools / toolRemaining /
 *    whispers) handed to the chatter engines through a VoicePoolsProvider;
 *  - 'panel': the hover-panel chrome (button labels, stat formats, action
 *    subset) served to the browser half through PetDefinition.panel.
 *
 * Discipline split matches the registry: STRUCTURE is fail-closed per file
 * (a non-object root drops the whole pack with a warning), CONTENT is
 * warn-and-drop per slot — one bad line never breaks a pet. The JSON Schema
 * twin lives at contracts/voice-pack-v1.schema.json for documentation and
 * external tooling; this hand-rolled normalizer is authoritative (the
 * repository ships no schema-validator runtime).
 *
 * Placeholder policy (each pool kind whitelists its own tokens):
 *  - status / whisper pools / panel labels: no placeholders allowed — a line
 *    carrying any '{...}' token is dropped with a warning;
 *  - tools: {tool} and {hint}; toolRemaining: {n}; panel stats:
 *    {rank} / {n} / {points}.
 *
 * This file is imported directly by scripts/dsh-pet under node's strip-only
 * TypeScript mode: keep it erasable-syntax-only.
 * @module @linxin666/dsh-pet/voice-pack
 */
import { type VoicePackOverrides, type WhisperRule } from './chatter.ts';
/** Schema version this module normalizes (optional field; missing = 1). */
export declare const VOICE_PACK_V1: 1;
/** Hover-panel action buttons a pack can show or hide (canonical order). */
export declare const PANEL_ACTIONS: readonly ["feed", "rename", "hide"];
export type PanelAction = (typeof PANEL_ACTIONS)[number];
/** Panel label slots (unset slots keep the client's i18n dictionary copy). */
export declare const PANEL_LABEL_KEYS: readonly ["feed", "rename", "hide", "confirm"];
export type PanelLabelKey = (typeof PANEL_LABEL_KEYS)[number];
/** Panel stat slots ({rank}/{n}/{points} interpolate the live values). */
export declare const PANEL_STAT_KEYS: readonly ["rank", "treats", "points"];
export type PanelStatKey = (typeof PANEL_STAT_KEYS)[number];
/** Hover-panel chrome overrides served to the browser half. */
export interface PetPanelView {
    /** Button / input labels; unset slots keep the i18n dictionary copy. */
    labels?: Partial<Record<PanelLabelKey, string>>;
    /** Stat line formats; unset slots keep the i18n dictionary copy. */
    stats?: Partial<Record<PanelStatKey, string>>;
    /** Actions to render in canonical order; absent = all three; [] = none. */
    actions?: PanelAction[];
}
/** One normalized voice pack (a pet's voice.json or the global override). */
export interface VoicePack {
    /** Chatter pool overrides (draw-time merged with the built-in pools). */
    overrides: VoicePackOverrides;
    /** Hover-panel chrome, when the pack declares any. */
    panel?: PetPanelView;
}
/** Hard caps shared by every pool slot (mirrors the remarks discipline). */
export declare const VOICE_POOL_LINES_MAX = 64;
export declare const VOICE_LINE_MAX = 160;
export declare const VOICE_KEYWORDS_PER_RULE_MAX = 16;
export declare const VOICE_KEYWORD_MAX = 40;
export declare const VOICE_RULES_MAX = 32;
export declare const VOICE_LABEL_MAX = 40;
export declare const VOICE_STAT_MAX = 80;
type PoolKind = 'status' | 'tools' | 'toolRemaining' | 'whisperGeneric' | 'whisperRule' | 'label' | 'stat';
/**
 * Normalize one pool slot. Accepts a single line or an array; non-string
 * entries warn and drop, empty lines drop silently, lines over the length
 * cap truncate, illegal placeholders drop the line, and pools over the line
 * cap keep their first lines. An explicit empty pool normalizes to [] (the
 * whisper channels read that as mute) while an absent slot normalizes to
 * undefined (the slot keeps the built-in pool).
 */
export declare function normalizePool(raw: unknown, kind: PoolKind, onWarning?: (message: string) => void): string[] | undefined;
/** Normalize the ordered keyword-rule list ([] disables the keyword channel). */
export declare function normalizeWhisperRules(raw: unknown, onWarning?: (message: string) => void): WhisperRule[] | undefined;
/** Normalize the panel block (labels / stats / actions; warn-and-drop). */
export declare function normalizePanel(raw: unknown, onWarning?: (message: string) => void): PetPanelView | undefined;
/** Voice-pack top-level fields ('$schema' mirrors the schema twin; drift-locked in tests). */
export declare const VOICE_PACK_KEYS: Set<string>;
/** Allowed whisper-section fields (drift-locked in tests). */
export declare const WHISPER_KEYS: Set<string>;
/**
 * Normalize one raw voice.json document into a VoicePack, or undefined when
 * the file cannot serve as a pack at all (non-object root — structure is
 * fail-closed per file). Every slot issue is a warning, never a throw.
 */
export declare function normalizeVoicePack(raw: unknown, onWarning?: (message: string) => void): VoicePack | undefined;
/**
 * Merge voice-pack layers into one pack; later layers win per slot. The
 * built-in pools are NOT a layer here — the chatter engines fall back to
 * them per key at draw time. Merge order for a selected pet:
 * mergeVoicePacks(registry.globalVoice, entry.voice).
 */
export declare function mergeVoicePacks(...layers: (VoicePack | undefined)[]): VoicePack | undefined;
export {};
//# sourceMappingURL=voice-pack.d.ts.map