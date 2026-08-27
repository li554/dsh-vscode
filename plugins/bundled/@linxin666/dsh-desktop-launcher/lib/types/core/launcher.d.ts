/**
 * Pure launcher generation: the PowerShell / POSIX launcher bodies, the
 * Windows shortcut installer, and the desktop file names for the three
 * supported platforms. No filesystem or process access — everything here is
 * testable without touching disk.
 */
/** Desktop platforms the launcher can generate an icon for. */
export type LauncherPlatform = 'win32' | 'darwin' | 'linux';
/** Launcher behavior, resolved from plugin config. */
export interface LauncherSpec {
    /** Command that starts dsh (must be on PATH when the launcher runs). */
    dshCommand: string;
    /** Base URL of the dsh web GUI. */
    url: string;
    /** Optional profile started as `dsh --profile <profile> --no-open`. */
    profile?: string;
    /** Optional icon file (.ico/.png) for the desktop icon; empty uses the bundled dsh icon. */
    iconPath?: string;
}
/** Default dsh command. */
export declare const DEFAULT_DSH_COMMAND = "dsh";
/** Default GUI URL. */
export declare const DEFAULT_URL = "http://127.0.0.1:3080";
/**
 * Fill defaults from a partial config (schema defaults may be absent in
 * hand-built test contexts). An empty profile means "no --profile flag".
 * @param config - partial launcher config.
 * @returns the resolved spec.
 */
export declare function resolveLauncherSpec(config: {
    dshCommand?: string;
    url?: string;
    profile?: string;
    iconPath?: string;
}): LauncherSpec;
/** File name of the launcher script under $DSH_HOME/desktop-launcher/. */
export declare function scriptFileName(platform: LauncherPlatform): string;
/** File name of the icon placed on the Desktop. */
export declare function desktopFileName(platform: LauncherPlatform): string;
/**
 * Render the launcher script for one platform.
 * @param platform - target desktop platform.
 * @param spec - resolved launcher behavior.
 * @returns the script body.
 */
export declare function renderLauncherScript(platform: LauncherPlatform, spec: LauncherSpec): string;
/**
 * Render the Linux desktop entry (the macOS launcher doubles as the desktop
 * file; Windows uses a .lnk created by the installer script).
 * @param launcherPath - absolute path of the launcher script.
 * @returns the .desktop file body.
 */
export declare function renderDesktopEntry(launcherPath: string, iconPath?: string): string;
/**
 * Render the Windows shortcut installer: a PowerShell script that creates
 * the Desktop .lnk pointing at the launcher.ps1, run hidden by the host.
 * @param opts - the launcher, icon, and working-directory paths.
 * @returns the installer body.
 */
export declare function renderShortcutInstaller(opts: {
    /** Absolute path of launcher.ps1. */
    launcherPath: string;
    /** Absolute path of the DSH.lnk to create. */
    desktopPath: string;
    /** Working directory of the shortcut (the home dir). */
    homeDir: string;
    /** Icon the shortcut shows (an .ico/.png path, or a shell-exe icon spec). */
    iconLocation: string;
}): string;
