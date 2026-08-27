/**
 * First-level settings section for dsh-doctor: the recovery console.
 *
 * Renders the supervisor snapshot (system phase, protected profiles,
 * incidents), the browser probe list and the diagnostic actions inside a
 * settings.section slot entry. All dynamic content sits behind a React error
 * boundary so a crash in one subview degrades to a recoverable fallback
 * instead of taking the settings surface down; the boundary reports into the
 * probe list.
 *
 * Semantic attrs: the root carries data-dsh-plugin="doctor"; parts carry bare
 * data-dsh-part values scoped by that plugin attribute.
 * @module @linxin666/dsh-doctor/client
 */
import { Component, type ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { DoctorController } from './doctor-controller.ts';
import type { DoctorSettingsHandle } from './doctor-settings.ts';
/** Business face injected by the slot registration. */
export interface DoctorConsoleInjected {
    controller: DoctorController;
    settings: DoctorSettingsHandle | null;
}
/** Composed props: the injected face plus the locale seat. */
export interface DoctorConsoleProps extends DoctorConsoleInjected {
    t: TranslateNS<'doctor'>;
    /**
     * Render inside the family plugin settings card: the card chrome provides
     * the header and the form staging owns the enable switch, so the console
     * skips both and keeps only the live status, incidents, probe and actions.
     */
    embedded?: boolean;
}
/** The recovery console: a first-level settings section, or the card body when embedded. */
export declare function DoctorRecoveryConsole(props: DoctorConsoleProps): ReactNode;
/** The plugin id recorded in a startup-failure probe message. */
export declare function pluginIdOf(message: string): string;
/**
 * Error boundary for the dynamic console area. Reports into the probe list and
 * renders a recoverable fallback; retry resets the boundary and refreshes.
 */
export declare class DoctorErrorBoundary extends Component<{
    t: TranslateNS<'doctor'>;
    onReport: (error: unknown) => void;
    onRecover: () => void;
    /** Lazy children: re-evaluated on every boundary render so a retry gets
     * fresh inputs instead of the stale element tree that crashed. */
    children: () => ReactNode;
}, {
    failed: boolean;
}> {
    state: {
        failed: boolean;
    };
    static getDerivedStateFromError(): {
        failed: boolean;
    };
    componentDidCatch(error: unknown): void;
    private reset;
    render(): ReactNode;
}
