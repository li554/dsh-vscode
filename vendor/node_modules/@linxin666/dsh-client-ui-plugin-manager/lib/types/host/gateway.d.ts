/**
 * The CLI gateway: installs and removals executed by spawning the official
 * `dsh plugin --profile <name> add|remove` CLI — the single writer for the
 * profile — with a bounded job table the HTTP layer polls. Every run captures
 * a layer snapshot before and after so the caller can render exactly what the
 * CLI changed (the conflict ledger). The npm web runtime has no installer
 * service, so this gateway is its write path; on runtimes with official
 * channels the browser half never calls it.
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */
import type { InstalledPluginItem } from '../core/protocol.ts';
import type { ControlChange } from '../core/conflict.ts';
import { type ProfileFacts } from './profile.ts';
/**
 * Validate an install spec or package id against shell metacharacters.
 * @param spec - the user-supplied spec or id.
 * @returns the rejection message, or undefined when the spec is safe.
 */
export declare function unsafeSpecReason(spec: string): string | undefined;
/** One CLI-backed operation in flight or settled. */
export interface GatewayJob {
    id: string;
    action: 'install' | 'update' | 'remove';
    spec: string;
    /** Installed package ID for an in-place npm update. */
    targetId?: string;
    /** Exact registry version the update must land on. */
    targetVersion?: string;
    phase: 'running' | 'done' | 'error';
    /** The installed row on success (install) or the removed row (remove). */
    plugin?: InstalledPluginItem;
    /** Layer changes the CLI applied, normalized for the conflict panel. */
    conflicts?: ControlChange[];
    /**
     * Duplicate-mount safeguard notices: bundles entries the CLI's
     * reconciliation added but the composition already mounted through a patch
     * row, stripped back out so the next boot cannot double-mount. Each notice
     * carries the conflict-row shape (the entry left the bundles layer:
     * enabled -> uninstalled) so the tab can render it with the existing rows;
     * the package itself stays installed and row-mounted.
     */
    notices?: ControlChange[];
    error?: string;
}
/** The binary search roots for the dsh CLI. */
export declare function findDshBinary(env?: NodeJS.ProcessEnv, platform?: string, exists?: (path: string) => boolean, hostEntryPath?: string | undefined): string | null;
/**
 * The spawn command for the dsh CLI on this platform. Windows runs the
 * npm-generated dsh.cmd wrapper by resolving its node binary and bin.js script
 * and spawning them directly: going through cmd.exe splits unquoted paths with
 * spaces (`'D:\Program' is not recognized`).
 * @param binary - the dsh CLI path found by {@link findDshBinary}.
 * @param platform - process platform (test seam).
 * @param localNodeExists - existence probe (test seam).
 * @param binJsExists - existence probe for the resolved bin script (test seam).
 * @returns the executable and the argument prefix to run the dsh bin script.
 */
export declare function dshSpawnCommand(binary: string, platform?: string, localNodeExists?: (path: string) => boolean, binJsExists?: (path: string) => boolean): {
    command: string;
    argsPrefix: string[];
};
/** Build the exact cmd.exe command line required to execute a trusted .cmd shim. */
export declare function windowsCmdShimArgs(binary: string, args: readonly string[]): string[];
/** Spawn the dsh CLI with piped stdio and no shell parsing (see {@link dshSpawnCommand}). */
export declare function spawnDsh(binary: string, args: string[], env: NodeJS.ProcessEnv): import("child_process").ChildProcessByStdio<null, import("stream").Readable, import("stream").Readable>;
/**
 * Detect whether the official installer channels exist on this runtime by
 * dumping the boot composition once: the npm-published web never contains
 * `plugin-installer` entries, DSHCode and the checkout web do. The browser
 * half reads the verdict from the `/mode` route so its channel probe never
 * has to hit the missing official route (which 405s into the console).
 * @param binary - dsh CLI path.
 * @param profileName - boot profile name.
 * @param env - process environment.
 * @param spawnImpl - spawn seam (test seam).
 * @returns true when the dump names the official installer channels.
 */
export declare function detectOfficialChannels(binary: string, profileName: string, env?: NodeJS.ProcessEnv, spawnImpl?: typeof spawnDsh): Promise<boolean>;
/** The gateway: serializes CLI operations through one job table and one mutation queue. */
export declare class CliGateway {
    private readonly facts;
    private readonly env;
    private readonly deps;
    private readonly jobs;
    /** Settlement order of finished jobs: the eviction ring keeps the newest {@link MAX_FINISHED_JOBS}. */
    private readonly finishedOrder;
    private counter;
    /** Mutation queue: two CLI runs must never interleave their before/after captures. */
    private queue;
    /**
     * @param facts - resolved profile locations.
     * @param env - process environment.
     * @param deps - spawn/binary seams (tests only; production uses the real CLI).
     */
    constructor(facts: ProfileFacts, env?: NodeJS.ProcessEnv, deps?: {
        spawnImpl?: typeof spawnDsh;
        findBinary?: (env: NodeJS.ProcessEnv) => string | null;
    });
    /**
     * Run one profile mutation after every mutation already queued. The returned
     * promise keeps the task's own result or rejection, while the queue tail is
     * always recovered so one failed write cannot block later work. Routes that
     * edit profile files directly must use this seam so they cannot overlap the
     * CLI install/remove writer.
     */
    withMutationLock<T>(task: () => Promise<T>): Promise<T>;
    /** Chain one fire-and-forget CLI mutation onto the shared queue. */
    private enqueue;
    /** Register a settled job and evict the oldest finished one beyond the ring cap. */
    private retainFinished;
    /** The dsh CLI path, through the test seam when present. */
    private binary;
    /** Spawn the CLI, through the test seam when present. */
    private spawnCli;
    /** Start an install; the caller polls {@link status}. */
    install(spec: string): {
        jobId: string;
    };
    /** Start an in-place npm update; the caller polls {@link status}. */
    update(id: string, version: string): {
        jobId: string;
    };
    /** Start a removal; the caller polls {@link status}. */
    remove(id: string): {
        jobId: string;
    };
    /**
     * Read one job's current state (a shallow copy). Finished jobs beyond the
     * ring cap are evicted and read as not-found, the same as an id that never
     * existed.
     */
    status(jobId: string): GatewayJob | undefined;
    /** Capture the layer snapshot and the dependency names (tolerant parse). */
    private capture;
    /** The plugin row a finished operation produced (installed or removed). */
    private rowFor;
    /** Run one CLI operation to settlement; an unexpected failure settles the job as error. */
    private run;
    /** The mutation body of {@link run}. */
    private runInner;
    /**
     * Post-mutation duplicate-mount safeguard (B9): remove the bundles entries
     * the CLI's reconciliation newly added for packages the before-state
     * composition already mounted through a patch row. The write goes through
     * the manifest's safe path (backup + tmp + atomic rename); entries the
     * user had before and entries with no row mount are never touched. A
     * failure of the guard itself settles the job as an error — a boot-breaking
     * bundles state is never left silently.
     * @param job - the settling job (error target on guard failure).
     * @param before - state captured before the CLI run.
     * @param after - state captured after the CLI run.
     * @returns the stripped entries, or undefined when the job failed.
     */
    private stripDuplicateMounts;
    /**
     * Roll back a freshly installed dependency through the official remove
     * path (which also drops its bundle), then settle the job as an error.
     * This is the owner-aware conflict resolution: the existing plugin keeps
     * its entry ids and enablement untouched.
     */
    private rollbackInstall;
    /**
     * Insert-entry package names of one installed dependency that resolve
     * nowhere: not the dependency itself, not another profile dependency, not
     * an official @deepseek-ai/* package, and absent from every node_modules
     * the loader could import them from. Import-time failures beyond this
     * static check still surface only at the first real boot.
     */
    private unresolvableInsertNames;
    /** The new dependency of an install, when one exists. */
    private newDependency;
    /** The claimed entry ids of one installed dependency (its own bundle patch, or its name). */
    private claimedEntriesOf;
    /** Whether the new install claims an entry id another plugin already holds. */
    private detectDuplicateClaims;
    /**
     * Boot preflight after an install: compose the profile with the CLI's
     * `--dump-config` (resolves every entry without binding the port). A failure
     * that implicates the new plugin disables it so the next start cannot fail;
     * an unrelated failure is reported without touching anything.
     */
    private verifyBoot;
}
