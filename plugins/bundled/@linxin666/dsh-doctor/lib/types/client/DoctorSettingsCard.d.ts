/**
 * The dsh-doctor plugin settings card inside the Web UI plugin group
 * (Settings → Web UI plugins): the enable switch plus the safety policy
 * toggles, staged through the family card form, and the live recovery
 * console embedded below them. Bound to the `doctor` settings namespace so
 * toggling enabled on also mounts the host diagnostic endpoints and
 * heartbeats.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { type CardActions, type CardShell, type FieldState } from './settings-form.ts';
import type { DoctorController } from './doctor-controller.ts';
/** The doctor namespace fields this card edits (the host section schema). */
export interface DoctorSettings {
    /** Master switch; the host mounts recovery routes only while enabled. */
    enabled?: boolean;
    /** Install the Supervisor and launcher on enable. */
    fullProtection?: boolean;
    /** Allow deterministic repairs to promote after the isolated gates pass. */
    autoRepair?: boolean;
    /** Host heartbeat cadence in milliseconds. */
    heartbeatIntervalMs?: number;
}
/** What the doctor card renders. */
export interface DoctorSettingsCardState extends CardShell {
    /** Master switch. */
    enabled: FieldState;
    /** Full protection switch. */
    fullProtection: FieldState;
    /** Auto repair switch. */
    autoRepair: FieldState;
}
/** The registration-side face the card slot entry injects. */
export interface DoctorSettingsCardFace extends CardActions {
    hooks: {
        /** Card snapshot bound by the renderer as useDoctorSettingsCard. */
        doctorSettingsCard: SnapshotStore<DoctorSettingsCardState>;
    };
    /** The live recovery console controller (null when the polling loop is unavailable). */
    controller: DoctorController | null;
}
/** Bridges the `doctor` scope onto the card staged form. */
export declare class DoctorSettingsCardController {
    private readonly form;
    private readonly store;
    /** @param scope - the bound settings scope for the `doctor` namespace. */
    constructor(scope: SettingsScope<DoctorSettings>);
    private projection;
    /** Build the form face the card slot registration injects. */
    inject(): Pick<DoctorSettingsCardFace, 'hooks'> & CardActions;
}
/** Props the renderer binds for the doctor card. */
export type DoctorSettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'doctor'> & InjectFace<DoctorSettingsCardFace>;
/**
 * Render the doctor card.
 * @param props - locale copy, the card snapshot, form actions, and the console controller.
 * @returns the card.
 */
export declare function DoctorSettingsCard(props: DoctorSettingsCardProps): import("react").JSX.Element;
