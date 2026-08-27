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
export const defaultPetStateConfig = { celebrateMs: 2400, failureMs: 2400 };
/**
 * Map one activity phase onto the animation contract.
 * - thinking → `running` and tool → `running-right` (focused work).
 * - review → `review` while answer text is streaming.
 * - waiting → `waiting` (expectant pose, needs user input).
 * - done → `jumping` (celebration), then back to `idle` after the window.
 * - failed → `failed` briefly, then back to `idle`.
 * - idle → `idle` (calm breathing loop).
 */
export function animationForPhase(phase) {
    switch (phase) {
        case 'thinking': return 'running';
        case 'tool': return 'running-right';
        case 'review': return 'review';
        case 'waiting': return 'waiting';
        case 'done': return 'jumping';
        case 'failed': return 'failed';
        case 'idle': return 'idle';
    }
}
/** The spritesheet row index for one animation track. */
export function rowOf(animation) {
    const rows = {
        'idle': 0,
        'running-right': 1,
        'running-left': 2,
        'waving': 3,
        'jumping': 4,
        'failed': 5,
        'waiting': 6,
        'running': 7,
        'review': 8,
    };
    return rows[animation];
}
/**
 * PetStateMachine — one instance per host process. Holds only the latest
 * input snapshot and terminal-state timing; no storage, no side effects.
 */
export class PetStateMachine {
    now;
    phase = 'idle';
    line;
    phrase;
    sessionActive = false;
    doneAt;
    failedAt;
    config;
    constructor(config = defaultPetStateConfig, now = Date.now) {
        this.now = now;
        this.config = { ...defaultPetStateConfig, ...config };
    }
    /** Consume one projected activity update. */
    onActivityStatus(input) {
        this.phase = input.phase;
        this.line = input.line;
        this.phrase = input.phrase;
        this.doneAt = input.phase === 'done' ? this.now() : undefined;
        this.failedAt = input.phase === 'failed' ? this.now() : undefined;
    }
    /** A session became the active one (or a fresh session started). */
    onSessionActive() {
        this.sessionActive = true;
    }
    /** The active session was disposed (or none left). */
    onSessionDisposed() {
        this.sessionActive = false;
        this.phase = 'idle';
        this.line = undefined;
        this.phrase = undefined;
        this.doneAt = undefined;
        this.failedAt = undefined;
    }
    /** Render the current animation decision. */
    render() {
        const nowMs = this.now();
        let animation = animationForPhase(this.phase);
        const doneSettled = this.phase === 'done'
            && this.doneAt !== undefined
            && nowMs - this.doneAt >= this.config.celebrateMs;
        const failedSettled = this.phase === 'failed'
            && this.failedAt !== undefined
            && nowMs - this.failedAt >= this.config.failureMs;
        if (doneSettled || failedSettled)
            animation = 'idle';
        // Settled sessions never bubble: idle (e.g. an aborted/stopped turn),
        // completed celebration expiry, and failed display expiry all fall silent.
        const settled = this.phase === 'idle' || doneSettled || failedSettled;
        const bubble = settled ? undefined : this.phrase ?? this.line;
        return {
            animation,
            ...(bubble === undefined ? {} : { bubble }),
            animationStartedAt: nowMs,
            phase: this.phase,
            sessionActive: this.sessionActive,
        };
    }
}
