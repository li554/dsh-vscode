/**
 * The pet settings card: pet selection plus display layout, bound to the
 * 'pet' settings namespace the host plugin registers. Rendered as an
 * always-open first-level settings page; the section wrapper below mounts it
 * as the content of the top-level 'settings.section' nav entry. The petId
 * choices come from the registry endpoint ('/api/pet/pets') — the same list
 * the sprite renders from — so the card carries no per-pet knowledge.
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts';
/** The pet's settings fields this card edits (the namespace's full schema). */
export interface PetSettings {
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Master switch. */
    visible?: boolean;
    /** Scale of the rendered pet in px (sprite cell height). */
    size?: number;
    /** Horizontal inset from the viewport right edge, px. */
    right?: number;
    /** Vertical inset from the viewport bottom edge, px. */
    bottom?: number;
    /** Selected pet id (a registry entry). */
    petId?: string;
    /** Status-decoration master switch (pet-center M5, #567). */
    decorationEnabled?: boolean;
}
/** What the pet settings card renders. */
export interface PetSettingsCardState extends CardShell {
    /** Plugin master switch. */
    enabled: CardFieldState;
    /** Master switch. */
    visible: CardFieldState;
    /** Pet scale. */
    size: CardFieldState;
    /** Right inset. */
    right: CardFieldState;
    /** Bottom inset. */
    bottom: CardFieldState;
    /** Selected pet. */
    petId: CardFieldState;
    /** Status-decoration master switch. */
    decorationEnabled: CardFieldState;
    /** Pet choices (registry ids + display names), loaded from the host. */
    petChoices: readonly {
        value: string;
        label: string;
    }[];
    /** Registry diagnostics (v1 migration hints, invalid entries), host-served. */
    petDiagnostics: readonly PetDiagnosticView[];
}
/** The registration-side face the card's slot entry injects. */
export interface PetSettingsCardFace extends CardActions {
    hooks: {
        /** Card snapshot bound by the renderer as usePetSettingsCard. */
        petSettingsCard: SnapshotStore<PetSettingsCardState>;
    };
}
/** One registry diagnostic as served by '/api/pet/diagnostics' (#623). */
export interface PetDiagnosticView {
    level: 'error' | 'warning';
    message: string;
}
/** Bridges the 'pet' scope onto the card's staged form. */
export declare class PetSettingsCardController {
    private readonly form;
    private readonly store;
    private readonly petChoices;
    private readonly petLabels;
    private diagnostics;
    private loaded;
    private attempts;
    private disposed;
    /** Pending deferred-load or retry timer; cancelled by dispose(). */
    private pendingTimer;
    /** @param scope - the bound settings scope for the 'pet' namespace. */
    constructor(scope: SettingsScope<PetSettings>);
    /** Fetch registry diagnostics once (soft-fail: an empty list on error). */
    private loadDiagnostics;
    /** Resolve the registry choices once (retried a few times on failure). */
    private loadPets;
    private projection;
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot and its form actions.
     */
    inject(): PetSettingsCardFace;
    /**
     * Release the card's scope subscription, bound stores and pending load
     * timers; the slot disposer calls this on teardown.
     */
    dispose(): void;
}
/** Props the renderer binds for the pet settings card. */
export type PetSettingsCardProps = PropsLocale<'pet'> & InjectFace<PetSettingsCardFace>;
/**
 * Render the pet settings card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export declare function PetSettingsCard(props: PetSettingsCardProps): import("react").JSX.Element;
/** Props the settings section binds for the pet card page. */
export type PetSettingsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'pet'> & InjectFace<PetSettingsCardFace>;
/** Render the pet settings card as a first-level settings page. */
export declare function PetSettingsSection(props: PetSettingsSectionProps): ReactNode;
//# sourceMappingURL=PetSettingsCard.d.ts.map