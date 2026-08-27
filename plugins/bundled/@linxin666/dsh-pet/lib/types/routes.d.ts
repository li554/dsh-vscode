/**
 * Pet HTTP routes — the browser half talks to the host through plain
 * same-origin JSON endpoints ('/api/pet/*') and loads pet assets from
 * '/pet/<id>/*'. The '/plugins/' endpoint only serves client bundles and RPC
 * domains are platform-registered, so the pet serves its own API and media —
 * the same pattern as dsh-remote-web-ui's '/api/pair' family. The asset route
 * is one prefix registration serving every registry entry (manifest, atlas,
 * optional previews), so adding a pet never touches route wiring. Both the
 * JSON API, the asset prefix, and the Live2D runtime prefix are loopback-only
 * by default; a live paired-device cookie is an extra allow path when
 * remote-web-ui is loaded.
 * @module @linxin666/dsh-pet/routes
 */
import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { PetService } from './service.ts';
/** Browser-facing base path of the pet API. */
export declare const PET_API_PREFIX = "/api/pet";
/** Browser-facing base path of the pet asset routes ('/pet/<id>/...'). */
export declare const PET_ASSET_PREFIX = "/pet";
/**
 * Per-class size ceilings for served pet assets, in bytes (pet-center M2 P3,
 * issue #623). Constants are tested directly; makePetRoutes accepts an
 * override so tests can exercise the 413 path with tiny caps.
 */
export declare const PET_ASSET_CAPS: {
    /** pet.json manifest. */
    readonly manifest: number;
    /** Atlas, preview and Live2D texture imagery. */
    readonly image: number;
    /** Live2D model closure files (.moc3, motion/physics/expression JSON; M3). */
    readonly model: number;
};
/** Size-cap profile the asset route enforces (test seam). */
export interface PetAssetCaps {
    manifest: number;
    image: number;
    model: number;
}
/**
 * realpath containment: resolve both sides and require the candidate to stay
 * inside the base directory. A pet directory (or an atlas/preview inside it)
 * that is a symlink escaping its root is rejected, never followed.
 */
export declare function containedRealpath(base: string, candidate: string): string | undefined;
/** Browser-facing base path of the plugin runtime files (pet-center M3). */
export declare const PET_RUNTIME_PREFIX: string;
/** Size ceiling for one runtime file (the Cubism Core is ~200 KB today). */
export declare const PET_RUNTIME_CAP: number;
/** Runtime file roots (test seam; defaults resolve from the environment). */
export interface PetRuntimeRoots {
    /** User-supplied runtime directory (defaults to '$DSH_HOME/pets/.runtime'). */
    runtimeDir?: string;
    /** Plugin vendor bundle directory (defaults to the package 'lib'). */
    vendorDir?: string;
}
/** Build the full route family (API + assets + runtime) for one service. */
export declare function makePetRoutes(deps: {
    service: PetService;
    ctx: Context;
    assetCaps?: PetAssetCaps;
} & PetRuntimeRoots): WebRoute[];
export { petPackageRoot } from './registry.ts';
//# sourceMappingURL=routes.d.ts.map