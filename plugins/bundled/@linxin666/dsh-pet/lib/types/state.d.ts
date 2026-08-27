/**
 * Pet state machine — pure, clock-injected. Maps official DSH session activity
 * and the legacy `activity/status` vocabulary onto the 9-state Codex pet
 * animation contract, plus turn-end celebration and no-session idle.
 *
 * The machine is deliberately dumb: it holds the last input phase, the
 * animation decision, and a one-shot "celebration" window after `done` so the
 * pet visibly jumps before settling back to idle. Everything here is a pure
 * function of (input, nowMs); persistence and RPC live in the service.
 * @module @linxin666/dsh-pet/state
 */
/** Activity phases understood by the pet host. */
export type ActivityPhase = 'idle' | 'waiting' | 'thinking' | 'tool' | 'review' | 'done' | 'failed';
/** The Codex-compatible 9-state animation contract (spritesheet rows). */
export type PetAnimation = 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review';
/** One input snapshot consumed by the machine. */
export interface PetStateInput {
    /** Current activity phase of the active session. */
    phase: ActivityPhase;
    /** Human-readable status line (plain text). */
    line?: string;
    /** Playful phrase from the activity tracker, when any. */
    phrase?: string;
}
/** Animation decision plus the copy the pet should show. */
export interface PetStateSnapshot {
    /** Which animation track to play. */
    animation: PetAnimation;
    /** Optional status bubble copy (line or phrase), shown while active. */
    bubble?: string;
    /** Wall-clock ms this animation started (client can sync loops). */
    animationStartedAt: number;
    /** Raw phase, for debugging and client-side rendering decisions. */
    phase: ActivityPhase;
    /** True when there is an active session (pet mounted). */
    sessionActive: boolean;
}
/** Machine configuration. */
export interface PetStateConfig {
    /** Celebration window after `done` before settling to idle, ms (default 2400). */
    celebrateMs: number;
    /** Failure display window before settling to idle, ms (default 2400). */
    failureMs: number;
}
export declare const defaultPetStateConfig: PetStateConfig;
/**
 * Map one activity phase onto the animation contract.
 * - thinking → `running` and tool → `running-right` (focused work).
 * - review → `review` while answer text is streaming.
 * - waiting → `waiting` (expectant pose, needs user input).
 * - done → `jumping` (celebration), then back to `idle` after the window.
 * - failed → `failed` briefly, then back to `idle`.
 * - idle → `idle` (calm breathing loop).
 */
export declare function animationForPhase(phase: ActivityPhase): PetAnimation;
/** The spritesheet row index for one animation track. */
export declare function rowOf(animation: PetAnimation): number;
/**
 * PetStateMachine — one instance per host process. Holds only the latest
 * input snapshot and terminal-state timing; no storage, no side effects.
 */
export declare class PetStateMachine {
    private readonly now;
    private phase;
    private line;
    private phrase;
    private sessionActive;
    private doneAt;
    private failedAt;
    private readonly config;
    constructor(config?: Partial<PetStateConfig>, now?: () => number);
    /** Consume one projected activity update. */
    onActivityStatus(input: PetStateInput): void;
    /** A session became the active one (or a fresh session started). */
    onSessionActive(): void;
    /** The active session was disposed (or none left). */
    onSessionDisposed(): void;
    /** Render the current animation decision. */
    render(): PetStateSnapshot;
}
//# sourceMappingURL=state.d.ts.map