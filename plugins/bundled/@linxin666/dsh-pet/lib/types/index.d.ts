/**
 * dsh-pet host half — mounts the pet service and its HTTP routes. The
 * browser half (the './client' entry) renders the selected pet and drives it
 * through the same-origin '/api/pet/*' JSON endpoints plus the '/pet/<id>/*'
 * media route. The host builds the multi-pet registry once at startup from
 * the package assets, the hatch-pet custom pets directory, and composed
 * config entries; adding a pet means dropping a manifest + atlas into one of
 * those sources, never touching host or client code. Install via
 * 'dsh plugin --profile web add link:<dsh-web-ui>/packages/dsh-pet'; the
 * cordis.patch.yml inserts this plugin row.
 * @module @linxin666/dsh-pet
 */
import { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
import { type PetConfig } from './service.ts';
export { PetService, MAX_SESSION_BUBBLES } from './service.ts';
export type { PetConfig, PetInteractResult, PetSettingsSection, PetSessionView, PetStateView, } from './service.ts';
export { AFFINITY_MAX, AFFINITY_RANKS, applyInteraction, applyTurnReward, emptyAffinity, rankOf, } from './affinity.ts';
export type { AffinityConfig, AffinityState, InteractionOutcome, PetInteraction, } from './affinity.ts';
export { animationForPhase, PetStateMachine, rowOf, } from './state.ts';
export type { ActivityPhase, PetAnimation, PetStateConfig, PetStateInput, PetStateSnapshot, } from './state.ts';
export { consumeTreat, defaultTreatConfig, emptyTreatLedger, settleTreatGrants, } from './treats.ts';
export type { TreatConfig, TreatLedger, TreatSettlement } from './treats.ts';
export { BUILTIN_REMARKS, REMARK_KINDS, REMARK_LINE_MAX, REMARK_LINES_MAX, RemarkPicker, builtinRemark, normalizePetRemarks, } from './remarks.ts';
export type { PetRemarks, PetRemarksManifest, RemarkKind } from './remarks.ts';
export { DEFAULT_PET_ID, DEFAULT_PET_NAME, PET_NAME_MAX_LENGTH, defaultDisplayConfig, emptyPersist, loadPetPersist, petHomeDir, savePetPersist, } from './persist.ts';
export type { PetDisplayConfig, PetPersist } from './persist.ts';
export { DEFAULT_FRAME_COUNTS, DEFAULT_PET_CELL, DEFAULT_PET_COLUMNS, DEFAULT_PET_ROW_COUNT, DEFAULT_TRACK_PATTERNS, PET_ROW_ORDER, codexPetsDir, loadPetRegistry, petEntryView, petPackageRoot, resolvePetManifest, } from './registry.ts';
export type { PetDefinition, PetEntry, PetManifest, PetRegistry, PetRegistryOptions, PetTrackDef, PetTrackOverride, } from './registry.ts';
export { makePetRoutes, PET_API_PREFIX, PET_ASSET_PREFIX, } from './routes.ts';
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export declare const name = "pet";
/** Services required before the pet can mount its surfaces. */
export declare const inject: string[];
/**
 * Settings section schema: pet selection and display fields the web settings
 * surface edits. petId is a plain string on purpose: the service clamps the
 * resolved value against the registry, so a stored selection that points at
 * a removed pet cannot invalidate the section (a strict union would refuse
 * the whole registration). The settings card renders the actual registry
 * choices itself from '/api/pet/pets'.
 */
export declare function makePetSettingsSchema(fallbackPetId: string): z<Schemastery.ObjectS<{
    visible: z<boolean, boolean>;
    size: z<number, number>;
    right: z<number, number>;
    bottom: z<number, number>;
    petId: z<string, string>;
    enabled: z<boolean, boolean>;
    decorationEnabled: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
    visible: z<boolean, boolean>;
    size: z<number, number>;
    right: z<number, number>;
    bottom: z<number, number>;
    petId: z<string, string>;
    enabled: z<boolean, boolean>;
    decorationEnabled: z<boolean, boolean>;
}>>;
/** Register the pet service and its API + asset routes on the context. */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: PetConfig): void;
//# sourceMappingURL=index.d.ts.map