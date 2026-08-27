/**
 * Live2D .model3.json reference closure — the set of files a model declares
 * (pet-center M2, issue #623). The host asset route only ever serves a pet's
 * declared manifest, its declared primary assets, and this closure; the CLI
 * validator reuses the same extractor so an install-time check proves the
 * serving set is complete.
 *
 * Cubism file family: Moc (.moc3), Textures (images), Physics (.physics3.json),
 * Pose (.pose3.json), DisplayInfo (.cdi3.json), Expressions[].File
 * (.exp3.json), Motions.<group>[].File (.motion3.json), UserData
 * (.userdata3.json). Every reference must be a safe manifest-relative path
 * (safeManifestPath); unsafe entries make the model unloadable.
 *
 * Erasable-syntax-only: scripts/ import this under node strip-only mode.
 * @module @linxin666/dsh-pet/model3
 */
/** Collect the safe relative paths one model3.json references. */
export declare function collectModel3References(model3: unknown): {
    references: string[];
    errors: string[];
};
/** The motion group names a model3.json declares (for CLI diagnostics). */
export declare function model3MotionGroups(model3: unknown): string[];
/** The hit area names a model3.json declares (top-level HitAreas). */
export declare function model3HitAreas(model3: unknown): string[];
//# sourceMappingURL=model3.d.ts.map