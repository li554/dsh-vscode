/** Pure timing helpers for manifest-defined scene animation sequences. */
import type { PetTrackDef } from '../registry.ts';
import type { PetAnimation } from '../state.ts';
export interface SequenceFrame {
    animation: PetAnimation;
    frameIndex: number;
}
/** Resolve the active track and frame after elapsed milliseconds of a looping sequence. */
export declare function sequenceFrameAt(sequence: readonly PetAnimation[], tracks: Record<PetAnimation, PetTrackDef>, elapsedMs: number): SequenceFrame;
//# sourceMappingURL=sequences.d.ts.map