/**
 * Pet persistence — tiny JSON store for affinity + display config, written
 * under $DSH_HOME (defaults to ~/.dsh) as `pet.json`. Deliberately minimal:
 * one file, atomic rename write, tolerant read (corrupt file → defaults).
 * @module @linxin666/dsh-pet/persist
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dshHome } from "./dsh-home.js";
import { AFFINITY_MAX, emptyAffinity } from "./affinity.js";
import { defaultTreatConfig, emptyTreatLedger } from "./treats.js";
export const defaultDisplayConfig = {
    visible: true,
    size: 160,
    right: 24,
    bottom: 120,
};
/** Display value bounds (shared by load-time validation and setConfig). */
export const DISPLAY_SIZE_MIN = 32;
export const DISPLAY_SIZE_MAX = 512;
export const DISPLAY_INSET_MAX = 10_000;
/** Pet id the legacy single-pet installs resolve to on migration. */
export const DEFAULT_PET_ID = 'whale-girl';
/** Default pet name (used only when a manifest carries no displayName). */
export const DEFAULT_PET_NAME = '鲸鱼娘';
/** Name constraints. */
export const PET_NAME_MAX_LENGTH = 20;
export function emptyPersist() {
    return {
        petId: DEFAULT_PET_ID,
        names: {},
        affinity: emptyAffinity(),
        treats: emptyTreatLedger(),
        display: { ...defaultDisplayConfig },
    };
}
/**
 * Resolve the persistence directory ($DSH_HOME or ~/.dsh). Delegates to the
 * shared {@link dshHome} resolution so the plugin family keeps one DSH_HOME
 * definition (env override, ~ expansion, cwd-joined relative values).
 */
export function petHomeDir() {
    return dshHome();
}
/** Numeric field guard: finite numbers only, else the fallback. */
function finiteNum(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
/** Sanitize the per-pet names map (string keys, non-empty trimmed values). */
function loadPetNames(parsed) {
    const names = {};
    if (typeof parsed.names !== 'object' || parsed.names === null)
        return names;
    for (const [id, value] of Object.entries(parsed.names)) {
        if (id === '' || typeof value !== 'string')
            continue;
        const name = value.trim();
        if (name === '')
            continue;
        names[id] = name.slice(0, PET_NAME_MAX_LENGTH);
    }
    return names;
}
/** Clamp one count/score into [0, max]. */
function clamp(value, max) {
    return Math.min(max, Math.max(0, value));
}
/** Load persisted state; missing or corrupt files fall back to defaults. */
export function loadPetPersist(dir = petHomeDir()) {
    try {
        const raw = readFileSync(join(dir, 'pet.json'), 'utf8');
        const parsed = JSON.parse(raw);
        const base = emptyPersist();
        const rawAffinity = (parsed.affinity ?? {});
        const affinity = {
            points: clamp(finiteNum(rawAffinity.points, 0), AFFINITY_MAX),
            lastPetAt: clamp(finiteNum(rawAffinity.lastPetAt, 0), Number.MAX_SAFE_INTEGER),
            lastFeedAt: clamp(finiteNum(rawAffinity.lastFeedAt, 0), Number.MAX_SAFE_INTEGER),
            pets: clamp(finiteNum(rawAffinity.pets, 0), Number.MAX_SAFE_INTEGER),
            feeds: clamp(finiteNum(rawAffinity.feeds, 0), Number.MAX_SAFE_INTEGER),
            petRejects: clamp(finiteNum(rawAffinity.petRejects, 0), Number.MAX_SAFE_INTEGER),
            feedRejects: clamp(finiteNum(rawAffinity.feedRejects, 0), Number.MAX_SAFE_INTEGER),
            turns: clamp(finiteNum(rawAffinity.turns, 0), Number.MAX_SAFE_INTEGER),
        };
        const rawTreats = (parsed.treats ?? {});
        const treats = {
            treats: clamp(finiteNum(rawTreats.treats, 0), defaultTreatConfig.maxTreats),
            lastTreatGrantAt: clamp(finiteNum(rawTreats.lastTreatGrantAt, 0), Number.MAX_SAFE_INTEGER),
            turnsAtLastTreatGrant: clamp(finiteNum(rawTreats.turnsAtLastTreatGrant, 0), Number.MAX_SAFE_INTEGER),
        };
        const rawDisplay = (parsed.display ?? {});
        const display = {
            visible: typeof rawDisplay.visible === 'boolean' ? rawDisplay.visible : base.display.visible,
            // The settings schema requires whole pixels; drag positions are
            // clamped but not integral, so round at the persistence boundary.
            size: Math.round(Math.min(DISPLAY_SIZE_MAX, Math.max(DISPLAY_SIZE_MIN, finiteNum(rawDisplay.size, base.display.size)))),
            right: Math.round(clamp(finiteNum(rawDisplay.right, base.display.right), DISPLAY_INSET_MAX)),
            bottom: Math.round(clamp(finiteNum(rawDisplay.bottom, base.display.bottom), DISPLAY_INSET_MAX)),
        };
        const petId = typeof parsed.petId === 'string' && parsed.petId.trim() !== ''
            ? parsed.petId.trim()
            : base.petId;
        const names = loadPetNames(parsed);
        // Legacy migration: pre-registry installs persisted one flat `name`
        // field. Move it onto the selected pet (the legacy whale-girl unless the
        // file already names another pet) so renames survive the upgrade.
        if (typeof parsed.name === 'string' && parsed.name.trim() !== '' && names[petId] === undefined) {
            names[petId] = parsed.name.trim().slice(0, PET_NAME_MAX_LENGTH);
        }
        return {
            petId,
            names,
            affinity,
            treats,
            display,
        };
    }
    catch {
        return emptyPersist();
    }
}
/** Atomically persist state (write temp + rename). */
export function savePetPersist(data, dir = petHomeDir()) {
    mkdirSync(dir, { recursive: true });
    const target = join(dir, 'pet.json');
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, target);
}
