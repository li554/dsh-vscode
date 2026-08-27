/**
 * Renderer registry — dispatches a manifest's renderer kind to its
 * implementation (pet-center M2 P4, issue #623). Unknown kinds never blank
 * the pet: a fallback card names the problem and reports the kinds this
 * build actually supports.
 * @module @linxin666/dsh-pet/client/renderers/registry
 */
/** Renderer dispatch table. */
export class RendererRegistry {
    renderers = new Map();
    /** Register one renderer implementation (id wins on re-register). */
    register(renderer) {
        this.renderers.set(renderer.id, renderer);
    }
    /** Whether a renderer kind is available in this build. */
    has(id) {
        return this.renderers.has(id);
    }
    /** The registered renderer kinds (for diagnostics). */
    kinds() {
        return [...this.renderers.keys()].sort();
    }
    /** Remove every registration (tests; the client index registers once). */
    clear() {
        this.renderers.clear();
    }
    /**
     * Mount a renderer for one activation. An unknown kind renders a clear
     * diagnostic card into the container instead of failing silently.
     */
    mount(kind, ctx, config) {
        const renderer = this.renderers.get(kind);
        if (renderer === undefined) {
            const note = document.createElement('div');
            note.dataset.dshPetRendererFallback = kind;
            note.textContent = 'Pet renderer "' + kind + '" is not available in this build (supported: ' + this.kinds().join(', ') + ').';
            ctx.container.appendChild(note);
            ctx.onCleanup(() => note.remove());
            return { dispose: () => note.remove() };
        }
        return renderer.mount(ctx, renderer.validateConfig(config));
    }
}
/**
 * The plugin-wide renderer registry. The client entry registers the
 * built-in renderers at apply time; the renderer switch and the live2d
 * bridge dispatch through this instance.
 */
export const defaultPetRendererRegistry = new RendererRegistry();
