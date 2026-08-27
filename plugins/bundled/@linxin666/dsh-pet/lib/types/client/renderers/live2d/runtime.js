/**
 * Live2D runtime loading (pet-center M3) — the two scripts a live2d mount
 * needs, fetched lazily through the plugin's own runtime route: the
 * user-supplied Cubism Core (proprietary; the plugin never bundles or
 * downloads it — issue #623 M1 §0) and the plugin-shipped MIT vendor bundle
 * (pixi.js + untitled-pixi-live2d-engine). Each loads at most once per page;
 * concurrent mounts share the in-flight promise, and a failure is cached as
 * 'absent' so a broken install stops retrying the network every mount.
 *
 * The vendor surface below is the structural slice the renderer consumes;
 * the real objects come from 'window.__dshPetLive2d' (lib/live2d-vendor.js),
 * so this module never imports pixi — the client bundle stays lean.
 * @module @linxin666/dsh-pet/client/renderers/live2d/runtime
 */
/** Runtime file URLs the host serves ('/api/pet/runtime/<name>', M3-2). */
const CORE_URL = '/api/pet/runtime/live2dcubismcore.min.js';
const VENDOR_URL = '/api/pet/runtime/live2d-vendor.js';
const defaultInjector = (src) => new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('script failed to load: ' + src));
    document.head.appendChild(tag);
});
let corePromise;
let vendorPromise;
/**
 * Ensure the Cubism Core global exists, injecting the runtime-route script
 * once when absent. Resolves false when the user has not installed the core
 * (a normal state — the renderer turns it into install guidance).
 */
export function ensureCubismCore(probe = {}) {
    if (typeof window !== 'undefined' && window.Live2DCubismCore !== undefined)
        return Promise.resolve(true);
    if (probe.inject !== undefined) {
        return probe.inject(CORE_URL)
            .then(() => typeof window !== 'undefined' && window.Live2DCubismCore !== undefined)
            .catch(() => false);
    }
    corePromise ??= defaultInjector(CORE_URL)
        .then(() => typeof window !== 'undefined' && window.Live2DCubismCore !== undefined)
        .catch(() => false);
    return corePromise;
}
/** Ensure the plugin vendor bundle global exists (same caching discipline). */
export function ensureLive2dVendor(probe = {}) {
    if (typeof window !== 'undefined' && window.__dshPetLive2d !== undefined)
        return Promise.resolve(window.__dshPetLive2d);
    if (probe.inject !== undefined) {
        return probe.inject(VENDOR_URL)
            .then(() => typeof window !== 'undefined' ? window.__dshPetLive2d : undefined)
            .catch(() => undefined);
    }
    vendorPromise ??= defaultInjector(VENDOR_URL)
        .then(() => typeof window !== 'undefined' ? window.__dshPetLive2d : undefined)
        .catch(() => undefined);
    return vendorPromise;
}
/** Reset the cached script promises (tests). */
export function resetLive2dRuntime() {
    corePromise = undefined;
    vendorPromise = undefined;
}
