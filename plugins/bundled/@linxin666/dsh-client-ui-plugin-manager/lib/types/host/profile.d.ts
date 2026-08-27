/**
 * Profile resolution and manifest reads for the gateway host half. The npm
 * web runtime has no plugin-installer service, so this package resolves the
 * boot profile from the host process's own argv (the launcher fact) and reads
 * the profile's package.json and cordis.patch.yml directly — reads only; every
 * write goes through the official CLI or the patch-row editor.
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */
/** Resolved locations of one profile's writable surface. */
export interface ProfileFacts {
    /** Profile name (the directory under $DSH_HOME/profiles). */
    profileName: string;
    /** Absolute profile directory. */
    profileDir: string;
    /** Absolute path of the profile's cordis.patch.yml. */
    patchPath: string;
    /** Absolute path of the profile's package.json. */
    packageJsonPath: string;
    /** True when the profile was inferred from the packaged desktop host. */
    desktop?: boolean;
}
/**
 * Strip a leading UTF-8 byte order mark (U+FEFF), which commonly appears in
 * files edited or created on Windows (PowerShell / Notepad).
 */
export declare function stripBom(text: string): string;
/** Read the packaged desktop app's persisted active profile, when present. */
export declare function desktopSelectedProfile(env?: NodeJS.ProcessEnv): string | undefined;
/**
 * Resolve the boot profile name from the host argv: an explicit `--profile`
 * flag wins, then the DSH_PROFILE environment override, then the `web`
 * subcommand alias. The launcher hands the app its own args verbatim, so the
 * web app's argv is the reliable source on every CLI-launched host.
 * @param argv - process argv (test seam).
 * @param env - process environment (test seam).
 * @returns the resolved profile facts.
 */
export declare function resolveProfile(argv?: readonly string[], env?: NodeJS.ProcessEnv): ProfileFacts;
/** The profile package.json surface the gateway reads. */
export interface ProfileManifest {
    /** dsh.profile.bundles entries (may be absent). */
    bundles: string[];
    /** package.json dependencies: package name -> install spec. */
    dependencies: Record<string, string>;
}
/**
 * Read the profile manifest; a missing or malformed file fails loud.
 * @param packageJsonPath - absolute path of the profile's package.json.
 * @returns the parsed bundles and dependencies.
 */
export declare function readProfileManifest(packageJsonPath: string): Promise<ProfileManifest>;
/**
 * Remove selected entries from the profile manifest's `dsh.profile.bundles`,
 * conservatively: a single backup copy, then a tmp write and an atomic-ish
 * rename over the target — the same discipline as the patch-row editor. Every
 * other key (dependencies included) round-trips untouched; entries not in
 * `names` keep their order. A missing bundles array is a no-op write.
 * @param packageJsonPath - absolute path of the profile's package.json.
 * @param names - bundle entries to strip (package names).
 */
export declare function stripProfileBundles(packageJsonPath: string, names: readonly string[]): Promise<void>;
/**
 * Read the profile patch text; a missing file is an empty layer.
 * @param patchPath - absolute path of cordis.patch.yml.
 * @returns the file text, or `[]` when absent.
 */
export declare function readPatchText(patchPath: string): Promise<string>;
/** Whether a profile directory exists (the gateway needs an initialized profile). */
export declare function profileExists(profileDir: string): boolean;
