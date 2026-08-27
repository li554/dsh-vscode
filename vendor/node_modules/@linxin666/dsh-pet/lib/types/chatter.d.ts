/**
 * Pet chatter — the pet's voice while sessions work. Two speakers live here:
 *
 *  1. The status voice (session bubbles): big per-scene copy pools instead of
 *     one fixed line per phase, a fine-grained tool-name → copy-family map,
 *     and a compact real-argument hint ('跑跑 npm test'), in the spirit of
 *     the working-activity plugin's status line. Lines rotate round-robin —
 *     while a phase persists the copy advances every few seconds, so the pet
 *     feels alive without flickering per streamed chunk.
 *  2. The murmur engine (碎碎念): the pet's inner whispers, woken by the
 *     model's own output — keyword moods (errors, test greens, plans,
 *     self-corrections, victories...) plus an ambient pool earned by output
 *     volume. A cooldown keeps whispers occasional.
 *
 * Pure and deterministic: round-robin everywhere (no Math.random), clocks are
 * injected. The first line of each status pool is the legacy fixed copy the
 * plugin has always shown, so existing installs keep their wording until the
 * scene cycles. No emoji anywhere (repository rule); ～ is the whale-girl's
 * signature.
 *
 * Since pet-center M4 (issue #677) every pool is overridable through a
 * {@link VoicePoolsProvider}: the built-in pools are the fallback layer, and
 * voice packs (per-pet voice.json / the global .voice.json) layer their
 * pools on top at draw time.
 * @module @linxin666/dsh-pet/chatter
 */
/** Status copy scenes — the situations a session bubble can report. */
export type StatusScene = 'prepare' | 'waiting' | 'thinking' | 'review' | 'toolResult' | 'done' | 'failed' | 'toolFailed' | 'maxTokens' | 'interrupted' | 'blocked';
/** While a scene persists, its copy advances on this cadence (ms). */
export declare const STATUS_ROTATE_MS = 4000;
/** Fixed-copy pools per status scene (first line = legacy wording). */
export declare const STATUS_POOLS: Readonly<Record<StatusScene, readonly string[]>>;
/** Tool families for friendlier per-tool status copy. */
export type ToolCategory = 'read' | 'write' | 'edit' | 'shell' | 'grep' | 'find' | 'ls' | 'webSearch' | 'webFetch' | 'mcp' | 'memory' | 'subagent' | 'todo' | 'browser' | 'git' | 'ask' | 'generic';
/** Every status scene key, in declaration order (voice-pack key allow-list). */
export declare const STATUS_SCENES: readonly StatusScene[];
/** Every tool-family key, in declaration order (voice-pack key allow-list). */
export declare const TOOL_CATEGORIES: readonly ToolCategory[];
/** Map a raw tool name onto its copy family (working-activity style regexes). */
export declare function toolCategory(toolName: string): ToolCategory;
/**
 * Per-family tool status pools. '{tool}' interpolates the compact tool name,
 * '{hint}' the compact real-argument hint (both optional per line); the first
 * entry of every pool is the legacy '正在使用 {tool}' wording.
 */
export declare const TOOL_POOLS: Readonly<Record<ToolCategory, readonly string[]>>;
/** Pools for the parallel-tools line; '{n}' interpolates the running count. */
export declare const TOOL_REMAINING_POOL: readonly string[];
/**
 * A compact, human-readable hint of what a tool call actually touches —
 * the command, the path, the pattern, the query. Best-effort parse of the
 * raw arguments JSON; unknown shapes stay hintless. Capped short so the
 * bubble stays compact.
 */
export declare function toolArgHint(toolName: string, argumentsJson: string): string | undefined;
/**
 * Round-robin voice for status copy. Scene-keyed picks stay STABLE while the
 * same scene repeats (streaming chunks re-emit the same phase many times per
 * second, and rotating per chunk would make the bubble flicker), but advance
 * once the scene has persisted past the rotation cadence, so a long thinking
 * stretch keeps changing its wording.
 */
export declare class StatusVoice {
    private readonly pools;
    private readonly rotateMs;
    private readonly counters;
    private lastScene;
    private lastLine;
    private lastLineAt;
    constructor(pools?: VoicePoolsProvider, rotateMs?: number);
    /** Draw the next line of one pool, advancing its round-robin cursor. */
    private draw;
    /** Reuse the stable line or advance when the cadence elapsed. */
    private voice;
    /**
     * A scene's effective pool: the voice-pack override when it carries lines,
     * else the built-in pool. Empty overrides fall back rather than blank the
     * bubble — a scene line always renders.
     */
    private scenePool;
    /** Status line for a phase scene. */
    scene(scene: StatusScene, nowMs: number): string;
    /** Status line for a tool call, with the real-argument hint when known. */
    tool(toolName: string, displayName: string, hint: string | undefined, nowMs: number): string;
    /** Status line while sibling tools still run (always reflects the count). */
    toolRemaining(count: number, nowMs: number): string;
}
/** One murmur trigger: keywords in the model output wake a themed pool. */
export interface WhisperRule {
    /** Lowercase substrings that wake this pool (matched against chunk text). */
    keywords: readonly string[];
    /** Themed inner-whisper lines. */
    pool: readonly string[];
}
/** Murmur pacing: cooldown between whispers and output volume that earns one. */
export declare const WHISPER_COOLDOWN_MS = 9000;
export declare const WHISPER_CHAR_BUDGET = 420;
/** How long a whisper stays on screen (host-side expiry). */
export declare const WHISPER_TTL_MS = 8000;
/** Ambient inner-whisper pool (no keyword needed; earned by output volume). */
export declare const WHISPER_GENERIC_POOL: readonly string[];
/** Keyword-triggered whisper rules, most specific moods first. */
export declare const WHISPER_RULES: readonly WhisperRule[];
/**
 * Voice-pack overrides (pet-center M4, issue #677): the content a voice
 * pack can replace, one pool at a time. Every field is optional — missing
 * keys inherit the built-in pools. Resolution happens at draw time through
 * a provider function, so swapping pets (or editing the global file) re-
 * voices live engines without rebuilding them.
 *
 * Override semantics:
 *  - status/tools/toolRemaining: a non-empty override replaces the built-in
 *    pool for that key; an empty override falls back to the built-in pool
 *    (a scene line always renders, so it can never be blanked).
 *  - whispers.generic / whispers.rules: the override REPLACES the built-in
 *    section; an empty array mutes that channel (ambient or keyword).
 */
export interface VoicePackOverrides {
    /** Status copy pools by scene; each key replaces that scene's pool. */
    status?: Partial<Record<StatusScene, readonly string[]>>;
    /** Tool copy pools by family; each key replaces that family's pool. */
    tools?: Partial<Record<ToolCategory, readonly string[]>>;
    /** The parallel-tools count line pool ({n} interpolates the count). */
    toolRemaining?: readonly string[];
    /** Murmur pools; each section replaces the built-in one as a whole. */
    whispers?: {
        /** Ambient inner-whisper pool (empty mutes ambient whispers). */
        generic?: readonly string[];
        /** Ordered keyword rules (empty disables keyword-triggered whispers). */
        rules?: readonly WhisperRule[];
    };
}
/** Read the current effective voice-pack overrides (draw-time resolution). */
export type VoicePoolsProvider = () => VoicePackOverrides;
/** The built-in voice pack: the plugin's default copy, unchanged since v1. */
export declare const BUILTIN_VOICE_PACK: VoicePackOverrides;
/**
 * The murmur engine (碎碎念): watches the model's own output and lets the pet
 * whisper its inner voice. Two ways to earn a whisper:
 *  - a keyword rule matches the fresh chunk text (themed whisper);
 *  - enough output volume flowed by without one (ambient whisper).
 * A cooldown keeps whispers occasional; all picks are round-robin so tests
 * reproduce exact lines. The voice-pack provider (pet-center M4) swaps the
 * pools at draw time, so a pet switch re-voices live engines in place.
 */
export declare class WhisperEngine {
    private readonly pools;
    private readonly cooldownMs;
    private readonly charBudget;
    private readonly counters;
    private genericCursor;
    private lastWhisperAt;
    private charsSinceWhisper;
    constructor(pools?: VoicePoolsProvider, cooldownMs?: number, charBudget?: number);
    /**
     * Effective keyword rules: an override replaces the built-in rules as a
     * whole; an explicit empty array disables keyword-triggered whispers.
     */
    private rules;
    /** Effective ambient pool (an explicit empty array mutes ambient whispers). */
    private generic;
    /**
     * Feed one model-output chunk (reasoning or text). Returns the whisper to
     * show, or undefined when the moment stays quiet.
     */
    feed(text: string, nowMs: number): string | undefined;
    private speak;
}
//# sourceMappingURL=chatter.d.ts.map