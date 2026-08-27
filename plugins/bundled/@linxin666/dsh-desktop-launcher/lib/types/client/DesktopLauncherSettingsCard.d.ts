/**
 * The desktop-launcher settings card: launcher behavior fields plus the
 * "create desktop icon" action and the shutdown confirmation toggle.
 * Registers into the `web-ui.plugin.item` slot the Web UI plugin group
 * renders, bound to the `desktop-launcher` settings namespace.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { type CardActions, type CardShell, type FieldState } from './settings-form.ts';
/** The desktop-launcher fields this card edits (the namespace full schema). */
export interface DesktopLauncherSettings {
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Whether the host announces the plugin to every agent. */
    announceToAgent?: boolean;
    /** Command that starts dsh. */
    dshCommand?: string;
    /** Base URL of the dsh web GUI. */
    url?: string;
    /** Optional profile passed as `dsh web --profile <profile>`. */
    profile?: string;
    /** Optional icon file (.ico/.png) for the desktop icon. */
    iconPath?: string;
    /** Whether the floating shutdown button asks for confirmation before exiting. */
    confirmShutdown?: boolean;
}
/** What the desktop-launcher card renders. */
export interface DesktopLauncherSettingsCardState extends CardShell {
    /** Master switch. */
    enabled: FieldState;
    /** Agent announcement switch. */
    announceToAgent: FieldState;
    /** dsh command. */
    dshCommand: FieldState;
    /** GUI URL. */
    url: FieldState;
    /** Startup profile. */
    profile: FieldState;
    /** Desktop icon file. */
    iconPath: FieldState;
    /** Confirm gate for shutdown. */
    confirmShutdown: FieldState;
}
/** The registration-side face the card slot entry injects. */
export interface DesktopLauncherSettingsCardFace extends CardActions {
    hooks: {
        /** Card snapshot bound by the renderer as useDesktopLauncherSettingsCard. */
        desktopLauncherSettingsCard: SnapshotStore<DesktopLauncherSettingsCardState>;
    };
}
/** Bridges the `desktop-launcher` scope onto the card staged form. */
export declare class DesktopLauncherSettingsCardController {
    private readonly form;
    private readonly store;
    /** @param scope - the bound settings scope for the `desktop-launcher` namespace. */
    constructor(scope: SettingsScope<DesktopLauncherSettings>);
    private projection;
    /**
     * Build the face the card slot registration injects.
     * @returns the card snapshot and its form actions.
     */
    inject(): DesktopLauncherSettingsCardFace;
}
/** Props the renderer binds for the desktop-launcher card. */
export type DesktopLauncherSettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'desktop-launcher'> & InjectFace<DesktopLauncherSettingsCardFace>;
/**
 * Render the desktop-launcher card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export declare function DesktopLauncherSettingsCard(props: DesktopLauncherSettingsCardProps): import("react").JSX.Element;
