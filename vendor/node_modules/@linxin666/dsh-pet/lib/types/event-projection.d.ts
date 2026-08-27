/**
 * Official session event projection — pure. Maps the durable DSH session
 * vocabulary onto the pet's visual phases and carries an optional completed-
 * turn reward for the ledger. Holds no state of its own; callers keep a
 * {@link ProjectionRuntime} per session and feed events in arrival order.
 *
 * Status copy comes from the chatter voice (big rotating pools, per-tool
 * families, real-argument hints), and streamed model output feeds the murmur
 * engine so the pet can whisper its inner voice (碎碎念). The wall clock is
 * injected by the caller, keeping every projection reproducible.
 * @module @linxin666/dsh-pet/event-projection
 */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { PetStateInput } from './state.ts';
import { StatusVoice, WhisperEngine, type VoicePoolsProvider } from './chatter.ts';
/** Runtime shape of the optional legacy activity event. */
export interface ActivityStatusEventLike {
    phase?: string;
    line?: string;
    phrase?: string;
}
/** Per-session facts needed to project the official event stream. */
export interface ProjectionRuntime {
    activeTools: Set<string>;
    officialEventsSeen: boolean;
    stepHadFailure: boolean;
    /** Round-robin status copy voice (scene-stable, cadence-rotated). */
    voice: StatusVoice;
    /** Inner-whisper engine fed by the model's own streamed output. */
    whispers: WhisperEngine;
}
/** One official event projection, optionally carrying a completed turn reward. */
export interface PetActivityTransition {
    input: PetStateInput;
    completedTurn?: number;
    /** A fresh inner whisper woken by this event's model output, when any. */
    whisper?: string;
}
/**
 * Fresh projection runtime for a newly seen session. The optional voice-pack
 * provider (pet-center M4, issue #677) hands both chatter engines their
 * pools; engines resolve overrides at draw time, so swapping the provider's
 * pack re-voices live runtimes without rebuilding them.
 */
export declare function emptyProjectionRuntime(pools?: VoicePoolsProvider): ProjectionRuntime;
/** Whether a legacy phase is part of the pet's supported vocabulary. */
export declare function isActivityPhase(phase: string): phase is PetStateInput['phase'];
/**
 * Project the durable DSH session vocabulary into the pet's visual phases.
 * Unknown and log-only events do not disturb the last meaningful activity.
 * @param nowMs - injected wall clock for copy rotation and whisper pacing.
 */
export declare function projectOfficialEvent(event: SessionEvent, runtime: ProjectionRuntime, nowMs?: number): PetActivityTransition | undefined;
//# sourceMappingURL=event-projection.d.ts.map