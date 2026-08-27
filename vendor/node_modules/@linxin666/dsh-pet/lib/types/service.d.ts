/**
 * Pet host service — the `pet.*` RPC domain. A composition facade: it wires
 * the pure event projection (`event-projection`) onto the state machine,
 * delegates the affinity economy to the ledger (`ledger`), and routes
 * persistence through `persist`. The API gateway maps these methods onto
 * `pet.state` / `pet.pets` / `pet.interact` / `pet.setVisible` /
 * `pet.setConfig` / `pet.setName` / `pet.setPet` for browser consumers.
 *
 * Concurrent sessions each keep their own machine: the sprite animation
 * follows the most recent meaningful event (the display session) while the
 * state view carries one bubble per active session.
 * @module @linxin666/dsh-pet/service
 */
import { Context, Service } from '@deepseek-ai/cordis';
import type { AffinityConfig, PetAffinityView, PetInteraction } from './affinity.ts';
import type { TreatConfig } from './treats.ts';
import { type LedgerInteractionResult } from './ledger.ts';
import { type PetDisplayConfig } from './persist.ts';
import { type PetDefinition, type PetManifest, type PetRegistry, type PetRegistryDiagnostic } from './registry.ts';
import type { DecorationView } from './contracts/status-decoration.ts';
import { type PetStateConfig, type PetStateSnapshot } from './state.ts';
/** Plugin configuration. */
export interface PetConfig {
    /** Affinity tuning. */
    affinity?: Partial<AffinityConfig>;
    /** State machine tuning. */
    state?: Partial<PetStateConfig>;
    /** Treat economy tuning. */
    treats?: Partial<TreatConfig>;
    /** Persistence directory override (defaults to $DSH_HOME). */
    persistDir?: string;
    /** Master switch for the plugin (browser half + host routes). */
    enabled?: boolean;
    /** Status-decoration master switch (pet-center M5, #567); defaults to on. */
    decorationEnabled?: boolean;
    /** Prebuilt registry (tests); defaults to scanning the package + user dirs. */
    registry?: PetRegistry;
    /** Extra manifest entries composed by the embedding application. */
    pets?: readonly PetManifest[];
}
/**
 * The pet's settings-namespace section: the pet selection and display fields
 * the web settings surface edits. `right`/`bottom` are also updated by drag
 * interactions, which keep the settings document in sync through the service.
 * Naming is per pet and lives outside the settings document (the hover-panel
 * rename targets the selected pet).
 */
export interface PetSettingsSection {
    /** Selected pet id (a registry entry; the service clamps stale values). */
    petId?: string;
    /** Master switch. */
    visible: boolean;
    /** Scale of the rendered pet in px (sprite cell height). */
    size: number;
    /** Horizontal inset from the viewport right edge, px. */
    right: number;
    /** Vertical inset from the viewport bottom edge, px. */
    bottom: number;
    /** Master switch for the plugin (browser half + host routes). */
    enabled?: boolean;
    /**
     * Status-decoration master switch (pet-center M5, #567). Defaults to on;
     * the settings surface mirrors this field and can turn it off.
     */
    decorationEnabled?: boolean;
}
/** Settings namespace of the pet capability. Spelled here rather than imported: the browser half spells the same value. */
export declare const PET_SETTINGS_NAMESPACE = "pet";
/**
 * One active TOP-LEVEL session as the pet displays it. Sessions run in
 * parallel, so each gets its own bubble while the sprite itself follows the
 * most recent meaningful event (the display session). Subagent children
 * report no bubble of their own: their work is already reflected by the
 * bubble of the conversation that spawned them, and the bubble buttons
 * navigate to GUI sessions, which subagents are not.
 */
export interface PetSessionView {
    /** Session identity (stringified for the wire; never exposed as a key). */
    sessionId: string;
    /** The animation this session's activity maps onto. */
    animation: PetStateSnapshot['animation'];
    /** This session's status bubble copy. */
    bubble: string;
    /** This session's raw activity phase. */
    phase: PetStateSnapshot['phase'];
}
/** Hard cap on simultaneously displayed session bubbles (most recent first). */
export declare const MAX_SESSION_BUBBLES = 12;
/** Snapshot returned by `pet.state`. */
export interface PetStateView {
    animation: PetStateSnapshot['animation'];
    bubble?: string;
    phase: PetStateSnapshot['phase'];
    sessionActive: boolean;
    /**
     * Per-session bubbles for every concurrently active TOP-LEVEL session,
     * most recent first; optional so older hosts without the multi-session
     * view stay consumable. The single 'bubble' above mirrors the display
     * session.
     */
    sessions?: PetSessionView[];
    /** Affinity ledger snapshot. */
    affinity: PetAffinityView;
    /** Display configuration. */
    display: PetDisplayConfig;
    /** The selected pet's registry identity. */
    pet: {
        /** Registry id. */
        id: string;
        /** Manifest display name (unrenamed default). */
        displayName: string;
        /** Manifest description. */
        description: string;
    };
    /** The selected pet's display name (user rename or manifest default). */
    name: string;
    /** Treat (小鱼干) stock snapshot. */
    treats: {
        /** Stocked treats now. */
        stocked: number;
        /** Stock cap. */
        max: number;
    };
    /**
     * The display session's fresh inner whisper (碎碎念), when one is within
     * its TTL — short inner-voice copy woken by the model's own output,
     * rendered by the client as a distinct whisper bubble.
     */
    whisper?: string;
    /**
     * The active status decoration (pet-center M5, #567), when the master
     * switch is on and the default decoration entry exists. Absent means the
     * browser half renders no ornament.
     */
    decoration?: DecorationView;
}
/** Result of `pet.interact`. */
export type PetInteractResult = LedgerInteractionResult;
declare module '@deepseek-ai/cordis' {
    interface Context {
        pet: PetService;
    }
}
/**
 * Cordis service exposing the pet RPC domain. Lazy: nothing is scanned or
 * written until an economic event or interaction arrives; event listeners
 * update only in-memory state, and persistence happens on economic changes
 * (turn rewards, feeds, config/name changes) — never on a read.
 */
export declare class PetService extends Service {
    static inject: string[];
    private readonly machine;
    private readonly stateConfig;
    private readonly ledger;
    private readonly registry;
    private readonly persistDir;
    private enabled;
    /** Status-decoration master switch (M5, #567); mirrored from settings. */
    private decorationEnabled;
    private disposeActivity;
    /** Session whose most recent meaningful event currently drives the global pet. */
    private displaySession;
    /**
     * Effective voice-pack overrides for the currently selected pet (M4,
     * #677). Cached per pet id; the registry is an immutable snapshot, so the
     * global pack and each entry's pack cannot change behind the cache.
     */
    private voiceCache;
    /**
     * Per-session activity, most recent last (Map insertion order). Bounded by
     * MAX_SESSION_BUBBLES so a burst of sessions cannot grow it without bound;
     * disposed sessions are removed by the 'session/disposed' listener.
     */
    private readonly sessionActivity;
    /**
     * Sessions whose reward source is the official event stream. This metadata
     * outlives transient visual resets so a derived legacy `done` cannot reward
     * the same turn again after the pet is disabled and re-enabled.
     */
    private readonly officialEventSessions;
    constructor(ctx: Context, config?: PetConfig);
    /**
     * The draw-time voice-pool provider handed to every projection runtime.
     * It re-resolves when the selected pet changes, so live engines re-voice
     * on the next draw without being rebuilt (M4, #677).
     */
    private voicePools;
    /** Whether the pet service consumes session activity while enabled. */
    isEnabled(): boolean;
    /** RPC: current pet state snapshot. */
    state(): Promise<PetStateView>;
    /** Current persisted display config (read-only view). */
    display(): PetDisplayConfig;
    /** RPC: the registry entries the browser half renders and selects from. */
    pets(): Promise<PetDefinition[]>;
    /** The loaded registry (the asset routes serve its entries). */
    registrySnapshot(): PetRegistry;
    /** RPC: structured registry diagnostics (pet-center M2, issue #623). */
    diagnostics(): Promise<{
        diagnostics: PetRegistryDiagnostic[];
    }>;
    /**
     * The active status decoration view (M5, #567): the default 'whale' entry
     * (user directories override built-ins by id), gated by the master switch.
     */
    private activeDecoration;
    /** The selected pet's registry entry. */
    activeEntry(): NonNullable<PetRegistry['entries'][number]>;
    /** Currently selected pet id (persisted). */
    selectedPetId(): string;
    /** The display name of one pet (user rename or manifest displayName). */
    petName(petId?: string): string;
    /** RPC: switch the selected pet (persisted, settings document mirrored). */
    setPetId(petId: string): Promise<{
        ok: true;
        petId: string;
    } | {
        ok: false;
        error: string;
    }>;
    /** Start or stop the session-activity listeners that drive the pet. */
    setEnabled(enabled: boolean): void;
    private syncActivity;
    /** Drop transient activity because terminal events missed while disabled cannot be replayed safely. */
    private resetActivity;
    /** Return the per-session activity record, creating it on first sight. */
    private activityOf;
    /**
     * Commit one activity: the session's own machine renders its bubble, and
     * the session becomes the host-global display session (most recent
     * meaningful event wins the sprite animation).
     */
    private applyActivity;
    /** RPC: pet or feed the pet. */
    interact(kind: PetInteraction): Promise<PetInteractResult>;
    /** RPC: show or hide the pet. */
    setVisible(visible: boolean): Promise<{
        ok: true;
        display: PetDisplayConfig;
    }>;
    /** RPC: update display config (size / position). Values are clamped to whole pixels. */
    setConfig(patch: Partial<PetDisplayConfig>): Promise<{
        ok: true;
        display: PetDisplayConfig;
    }>;
    /** RPC: rename the selected pet (trimmed, 1–20 chars, per-pet storage). */
    setName(name: string): Promise<{
        ok: true;
        name: string;
    } | {
        ok: false;
        error: string;
    }>;
    /**
     * Apply a committed settings section to the persisted selection and display
     * config. Called by the settings surface on every change; values are
     * clamped exactly like the setConfig RPC so both write paths converge.
     * @param section - the resolved settings section.
     */
    applySettingsSection(section: PetSettingsSection): void;
    /** Mirror the persisted display config into the settings document (best-effort). */
    private syncSettingsFromPet;
    /** Award the turn reward once per completed turn (idempotent per session + turn). */
    private rewardTurn;
    /** Preserve turn rewards for installations that only emit legacy activity. */
    private rewardLegacyTurn;
    private view;
    private flush;
}
//# sourceMappingURL=service.d.ts.map