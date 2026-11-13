/**
 * Host-side localization for dsh-rewind's command output and command
 * description.
 *
 * Architecture (matches the dsh ecosystem): the HOST half of a dual-face
 * plugin has no locale service — only the browser client carries one. The host
 * therefore renders its command-adjacent copy from the durable user preference
 * dsh-client-locale persists, defaulting to English — the ecosystem's neutral
 * default language (the harness `FALLBACK_LOCALE`). See packages/client/locale
 * in deepseek-harness.
 *
 * DSH 0.1.7 moved that preference out of a registered settings section into the
 * `locale` entry's own Config, so the host reads it through the settings
 * service's descriptor read (`readHostLocale` in `src/index.ts`) — the same
 * public read the settings UI and the client's own locale runtime perform.
 *
 * The client half (`src/client/locales.ts`) owns all interactive UI copy via
 * `ctx.locale` + `t()`; the client never parses host prose (the popover reads
 * travel over the host `/api` query routes).
 *
 * DSH localizes only its OWN command descriptions via the client locale — a
 * closed `HOST_FACES` allowlist; third-party plugin descriptions are
 * not in that channel (see docs/compat/audit.md, RU-I18N), and no host command
 * OUTPUT is localized for anyone, so this dictionary is what carries it.
 *
 * English is the canonical key set: every other dictionary is typed complete
 * against it, and the tests compare every dictionary's template placeholders
 * with it. Adding a language is one dictionary plus one entry in `HOST_DICTS`.
 *
 * @module dsh-rewind/locales
 */
/** English dictionary — the canonical key set (neutral default). */
export declare const en: {
    'plan.skip': string;
    'skipReason.oversized': string;
    'skipReason.parent': string;
    'skipReason.unsafe': string;
    'skipReason.missing': string;
    'error.invalidTarget': string;
    'sep.list': string;
    'sep.clause': string;
    'failures.suffix': string;
    'failures.item': string;
    inflight: string;
    stopFailed: string;
    cancelled: string;
    failed: string;
    'restore.count': string;
    'delete.count': string;
    'skip.count': string;
    noRestorable: string;
    noCheckpoint: string;
    backupOff: string;
    storeUnsupported: string;
    success: string;
    noUserMessages: string;
    'command.description': string;
    'command.undoDescription': string;
    'engine.description': string;
    'engine.rejected': string;
    'engine.inputHint': string;
    'cleanup.description': string;
    'cleanup.inputHint': string;
    'cleanup.status': string;
    'cleanup.enabled': string;
    'cleanup.disabled': string;
    'cleanup.onOk': string;
    'cleanup.offOk': string;
    'cleanup.maxAgeOk': string;
    'cleanup.cfgInvalid': string;
    'cleanup.saveFailed': string;
    'cleanup.runDry': string;
    'cleanup.runApply': string;
    'cleanup.runFailed': string;
    'cleanup.skipped': string;
    'cleanup.clearDry': string;
    'cleanup.clearApply': string;
    'cleanup.clearActive': string;
    'cleanup.clearCancelled': string;
    'cleanup.clearFailed': string;
    'cleanup.usage': string;
};
/** The host rewind dictionary key union. */
export type HostKey = keyof typeof en;
/** Chinese dictionary, checked complete against the en key set. */
export declare const zh: Record<HostKey, string>;
/** Japanese dictionary, checked complete against the en key set. */
export declare const ja: Record<HostKey, string>;
/** Spanish dictionary, checked complete against the en key set. */
export declare const es: Record<HostKey, string>;
/** French dictionary, checked complete against the en key set. */
export declare const fr: Record<HostKey, string>;
/** German dictionary, checked complete against the en key set. */
export declare const de: Record<HostKey, string>;
/** Russian dictionary, checked complete against the en key set. */
export declare const ru: Record<HostKey, string>;
/** Brazilian Portuguese dictionary, checked complete against the en key set. */
export declare const pt: Record<HostKey, string>;
/**
 * Every language this plugin ships a host dictionary for. English is first as
 * the canonical dictionary; the rest follow the harness's language order.
 * Adding a language is one dictionary above plus one entry here — the locale-id
 * type, the preference resolver, and the tests all derive from this map.
 */
export declare const HOST_DICTS: {
    en: {
        'plan.skip': string;
        'skipReason.oversized': string;
        'skipReason.parent': string;
        'skipReason.unsafe': string;
        'skipReason.missing': string;
        'error.invalidTarget': string;
        'sep.list': string;
        'sep.clause': string;
        'failures.suffix': string;
        'failures.item': string;
        inflight: string;
        stopFailed: string;
        cancelled: string;
        failed: string;
        'restore.count': string;
        'delete.count': string;
        'skip.count': string;
        noRestorable: string;
        noCheckpoint: string;
        backupOff: string;
        storeUnsupported: string;
        success: string;
        noUserMessages: string;
        'command.description': string;
        'command.undoDescription': string;
        'engine.description': string;
        'engine.rejected': string;
        'engine.inputHint': string;
        'cleanup.description': string;
        'cleanup.inputHint': string;
        'cleanup.status': string;
        'cleanup.enabled': string;
        'cleanup.disabled': string;
        'cleanup.onOk': string;
        'cleanup.offOk': string;
        'cleanup.maxAgeOk': string;
        'cleanup.cfgInvalid': string;
        'cleanup.saveFailed': string;
        'cleanup.runDry': string;
        'cleanup.runApply': string;
        'cleanup.runFailed': string;
        'cleanup.skipped': string;
        'cleanup.clearDry': string;
        'cleanup.clearApply': string;
        'cleanup.clearActive': string;
        'cleanup.clearCancelled': string;
        'cleanup.clearFailed': string;
        'cleanup.usage': string;
    };
    zh: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    ja: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    es: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    fr: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    de: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    ru: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
    pt: Record<"backupOff" | "cancelled" | "cleanup.cfgInvalid" | "cleanup.clearActive" | "cleanup.clearApply" | "cleanup.clearCancelled" | "cleanup.clearDry" | "cleanup.clearFailed" | "cleanup.description" | "cleanup.disabled" | "cleanup.enabled" | "cleanup.inputHint" | "cleanup.maxAgeOk" | "cleanup.offOk" | "cleanup.onOk" | "cleanup.runApply" | "cleanup.runDry" | "cleanup.runFailed" | "cleanup.saveFailed" | "cleanup.skipped" | "cleanup.status" | "cleanup.usage" | "command.description" | "command.undoDescription" | "delete.count" | "engine.description" | "engine.inputHint" | "engine.rejected" | "error.invalidTarget" | "failed" | "failures.item" | "failures.suffix" | "inflight" | "noCheckpoint" | "noRestorable" | "noUserMessages" | "plan.skip" | "restore.count" | "sep.clause" | "sep.list" | "skip.count" | "skipReason.missing" | "skipReason.oversized" | "skipReason.parent" | "skipReason.unsafe" | "stopFailed" | "storeUnsupported" | "success", string>;
};
/** Host-side supported locale ids (the registry keys). */
export type HostLocaleId = keyof typeof HOST_DICTS;
/** Neutral default, matching the harness's `FALLBACK_LOCALE`. */
export declare const DEFAULT_HOST_LOCALE: "en";
/**
 * The locale a durable preference selects from this plugin's dictionaries.
 *
 * The harness accepts any BCP 47-style id while this plugin ships a fixed set,
 * so the preference is matched against the registry: the full tag first
 * (case-insensitively), then its primary subtag (`xx-YY` → `xx`), mirroring the
 * client runtime. Anything else — an unset preference, an unsupported language,
 * a non-string value — is the neutral default.
 *
 * @param preference - the raw `locale.preference` value.
 * @returns the dictionary this plugin renders its host copy in.
 */
export declare function preferredLocale(preference: unknown): HostLocaleId;
/**
 * Render one dictionary key with `{name}` template interpolation. Unknown
 * params are ignored; a missing key falls back to the raw key so a dictionary
 * gap is visible instead of blank.
 * @param lang - the active locale id.
 * @param key - the dictionary key.
 * @param params - `{name}` substitution values.
 */
export declare function translate(lang: HostLocaleId, key: HostKey, params?: Record<string, string | number>): string;
