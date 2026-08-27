/**
 * Renderer registry — dispatches a manifest's renderer kind to its
 * implementation (pet-center M2 P4, issue #623). Unknown kinds never blank
 * the pet: a fallback card names the problem and reports the kinds this
 * build actually supports.
 * @module @linxin666/dsh-pet/client/renderers/registry
 */
import type { PetRenderer, PetRendererContext, PetRendererHandle } from '../../contracts/renderer.ts';
/** Renderer dispatch table. */
export declare class RendererRegistry {
    private readonly renderers;
    /** Register one renderer implementation (id wins on re-register). */
    register(renderer: PetRenderer): void;
    /** Whether a renderer kind is available in this build. */
    has(id: string): boolean;
    /** The registered renderer kinds (for diagnostics). */
    kinds(): string[];
    /** Remove every registration (tests; the client index registers once). */
    clear(): void;
    /**
     * Mount a renderer for one activation. An unknown kind renders a clear
     * diagnostic card into the container instead of failing silently.
     */
    mount(kind: string, ctx: PetRendererContext, config: unknown): PetRendererHandle;
}
/**
 * The plugin-wide renderer registry. The client entry registers the
 * built-in renderers at apply time; the renderer switch and the live2d
 * bridge dispatch through this instance.
 */
export declare const defaultPetRendererRegistry: RendererRegistry;
//# sourceMappingURL=registry.d.ts.map