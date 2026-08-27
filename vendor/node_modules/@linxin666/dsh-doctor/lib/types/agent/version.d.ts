/**
 * Package version identity for the machine-side halves.
 *
 * The version always comes from the package.json next to the compiled module
 * (one level above lib/ for built bundles and src/ for repo runs), so a
 * published bump is picked up without touching hardcoded literals. The
 * Supervisor reports this version and the CLI pins the rescue-capsule install
 * spec to it; the Web console compares it with the host half's own version to
 * detect a stale Supervisor after an update.
 * @module @linxin666/dsh-doctor/agent
 */
/** Read the version of the package owning a module file. */
export declare function packageVersionAt(moduleFilePath: string): string;
/** Version of the package the current module belongs to (bundled-aware). */
export declare function currentPackageVersion(): string;
