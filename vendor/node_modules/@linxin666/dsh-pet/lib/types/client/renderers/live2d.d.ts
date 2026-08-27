/**
 * Live2D renderer (pet-center M3, issue #623) — mounts a Cubism model into
 * the center-owned container through the lazy vendor stack. The mount call
 * itself is synchronous per the renderer contract: the boot (core script →
 * vendor script → pixi → model) continues asynchronously and reports fatal
 * failures through the handle's error sink, so the React bridge can render
 * localized guidance. Disposing mid-boot is race-safe.
 *
 * Interaction model: the center chrome owns the affinity economy (its click
 * handler fires the pet interaction exactly like sprite2d); this renderer's
 * 'tap' affordance only drives the model's hit-area motion feedback. The
 * contract's interact write-back stays available for future standalone
 * mounts and is intentionally not invoked here.
 *
 * Motion mapping: manifests map ActivityPhases to motion GROUP names; every
 * unmapped phase (and any mapped-but-absent group) falls back to the idle
 * group — official sample models only ship Idle/TapBody, so the fallback is
 * mandatory. Groups with multiple motions pick a random entry, and a tap
 * that hits a declared hit area plays the conventional 'TapBody' group,
 * returning to the phase's group when the tap motion finishes.
 * @module @linxin666/dsh-pet/client/renderers/live2d
 */
import type { ActivityPhase } from '../../state.ts';
import { type PetRenderer, type PetRendererHandle } from '../../contracts/renderer.ts';
/** Renderer config: the client-visible live2d block (fail-closed validated). */
export interface PetLive2dConfig {
    modelUrl: string;
    scale?: number;
    translate?: {
        x?: number;
        y?: number;
    };
    motions: Partial<Record<ActivityPhase, string>> & {
        idle: string;
    };
    expressions?: Partial<Record<ActivityPhase, string>>;
    hitAreas?: string[];
}
/** Fatal mount failure codes the bridge localizes. */
export type Live2dErrorCode = 'core-missing' | 'vendor-missing' | 'load-failed';
/** The live2d activation handle: contract dispose plus tap + error sink. */
export interface Live2dRendererHandle extends PetRendererHandle {
    /** Forward a chrome tap in container coordinates; plays the hit motion. */
    tap(x: number, y: number): void;
    /** Subscribe to fatal mount errors (at most one fires per activation). */
    onError(listener: (code: Live2dErrorCode) => void): void;
}
/** Reset module state (tests). */
export declare function resetLive2dRenderer(): void;
/** The live2d renderer implementation. */
export declare const live2dRenderer: PetRenderer<PetLive2dConfig>;
//# sourceMappingURL=live2d.d.ts.map