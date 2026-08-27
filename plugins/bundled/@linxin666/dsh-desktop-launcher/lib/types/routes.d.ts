/**
 * The /api/dsh-desktop-launcher route family: one POST that writes the
 * launcher script under $DSH_HOME/desktop-launcher/ and places the double-click
 * icon on the Desktop. Every route carries the same loopback-only trust
 * fence as the dsh-ssh routes — this endpoint writes files on the host
 * machine, so LAN-exposed dsh web deployments must not serve it.
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type LauncherSpec } from './core/launcher.ts';
import { type CreateResult } from './protocol.ts';
/** Result of one spawned command (tests inject a fake runner). */
export interface CommandResult {
    /** Process exit code. */
    code: number | null;
    /** Captured stderr. */
    stderr: string;
}
/** Runner signature: execute a command with arguments and report its exit. */
export type CommandRunner = (file: string, args: string[]) => Promise<CommandResult>;
/** Route dependencies: the live spec resolver plus test seams. */
export interface LauncherRoutesDeps {
    /** Resolve the live launcher spec (composition + settings). */
    resolveSpec: () => LauncherSpec;
    /** Home directory (defaults to os.homedir()): the OS desktop the icon lands on. */
    homeDir?: string;
    /** DSH home directory for launcher assets (defaults to $DSH_HOME, then ~/.dsh). */
    dshHomeDir?: string;
    /** Host platform (defaults to process.platform). */
    platform?: string;
    /** Command runner (defaults to child_process.execFile). */
    run?: CommandRunner;
    /** Test seam: explicit icon source file (overrides discovery). */
    iconSource?: string;
}
/**
 * Write the launcher script and place the desktop icon for the current
 * platform. Refreshing is idempotent: rerunning overwrites both files.
 * @param deps - spec resolver plus test seams.
 * @returns the icon path and any non-fatal warning.
 */
export declare function createDesktopShortcut(deps: LauncherRoutesDeps): Promise<CreateResult>;
/**
 * Build the /api/dsh-desktop-launcher route family.
 * @param deps - spec resolver plus test seams.
 * @returns the routes.
 */
export declare function makeRoutes(deps: LauncherRoutesDeps): {
    routes: WebRoute[];
};
