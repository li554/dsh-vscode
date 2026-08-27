/**
 * Spritesheet geometry helpers — parameterized by the pet definition the
 * host serves over '/api/pet/pets', so the browser half renders any registry
 * entry without per-pet code. The per-track tables (frames, durations, loop,
 * fallback) also come from the registry; these helpers only place frames,
 * guard track lengths, and map the fixed 9-row animation contract.
 * @module @linxin666/dsh-pet/client/spritesheet
 */
import { type PetAnimation } from '../state.ts';
import type { PetCell, PetTrackDef } from '../registry.ts';
/** Animation track shape the frame loop consumes. */
export type TrackDef = PetTrackDef;
/** Row index of one animation track (the fixed 9-row contract). */
export declare function rowOfTrack(animation: PetAnimation): number;
/**
 * Background-position (px) of one frame cell within the scaled atlas.
 * The background image is scaled by `scale` (element size ÷ cell size), and
 * background-position offsets are applied in SCALED coordinates — using raw
 * atlas coordinates here would drift each frame by the scale factor and
 * render torn/overlapping frames.
 */
export declare function framePosition(cell: PetCell, row: number, col: number, scale?: number): {
    x: number;
    y: number;
};
/**
 * Trim a track to the actual frame count of its row (the manifest's per-row
 * counts are authoritative; this is a last-line guard against a definition
 * whose row count disagrees with its track table). A row with 0 detected
 * frames degrades to the first frame so the pet never renders blank.
 */
export declare function trimTrack(track: TrackDef, frameCount: number): TrackDef;
//# sourceMappingURL=spritesheet.d.ts.map