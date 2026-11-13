/** `rewind` namespace dictionaries for the client plugin. */
/** English dictionary — the canonical key set (the harness fallback language). */
export declare const en: {
    'button.title': string;
    'button.aria': string;
    'button.retract.aria': string;
    'popover.title': string;
    'popover.noText': string;
    'popover.chat': string;
    'popover.chat.hint': string;
    'popover.both': string;
    'popover.both.hint': string;
    'popover.checking': string;
    'popover.noChanges': string;
    'popover.backupDisabled': string;
    'popover.impact.loading': string;
    'popover.impact.failed': string;
    'popover.impact.none': string;
    'popover.impact.restore': string;
    'popover.impact.delete': string;
    'popover.confirm': string;
    'popover.back': string;
    'popover.retract.title': string;
    'popover.retract.target': string;
    'popover.retract.hint': string;
    'popover.cancel': string;
    'backup.title': string;
    'backup.on': string;
    'backup.off': string;
    'cleanup.auto': string;
    'cleanup.auto.on': string;
    'cleanup.auto.off': string;
    'cleanup.maxAge': string;
    'cleanup.maxAge.hint': string;
    'cleanup.invalid': string;
    'cleanup.overridden': string;
    'cleanup.reset': string;
    'cleanup.save': string;
    'cleanup.saving': string;
    'cleanup.saveFailed': string;
    'cleanup.readonly': string;
    'cleanup.unavailable': string;
};
/** The rewind namespace key union. */
export type RewindKey = keyof typeof en;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The in-place rewind controls' copy. */
        rewind: RewindKey;
    }
}
/** Chinese dictionary, checked complete against the en key set. */
export declare const zh: Record<RewindKey, string>;
/** Japanese dictionary, checked complete against the en key set. */
export declare const ja: Record<RewindKey, string>;
/** Spanish dictionary, checked complete against the en key set. */
export declare const es: Record<RewindKey, string>;
/** French dictionary, checked complete against the en key set. */
export declare const fr: Record<RewindKey, string>;
/** German dictionary, checked complete against the en key set. */
export declare const de: Record<RewindKey, string>;
/** Russian dictionary, checked complete against the en key set. */
export declare const ru: Record<RewindKey, string>;
/** Brazilian Portuguese dictionary, checked complete against the en key set. */
export declare const pt: Record<RewindKey, string>;
/**
 * Every dictionary this plugin ships, canonical first. Registration takes this
 * map as a whole, so shipping another language is one dictionary above plus one
 * entry here — no wiring change in `index.ts`.
 */
export declare const CLIENT_DICTS: {
    en: {
        'button.title': string;
        'button.aria': string;
        'button.retract.aria': string;
        'popover.title': string;
        'popover.noText': string;
        'popover.chat': string;
        'popover.chat.hint': string;
        'popover.both': string;
        'popover.both.hint': string;
        'popover.checking': string;
        'popover.noChanges': string;
        'popover.backupDisabled': string;
        'popover.impact.loading': string;
        'popover.impact.failed': string;
        'popover.impact.none': string;
        'popover.impact.restore': string;
        'popover.impact.delete': string;
        'popover.confirm': string;
        'popover.back': string;
        'popover.retract.title': string;
        'popover.retract.target': string;
        'popover.retract.hint': string;
        'popover.cancel': string;
        'backup.title': string;
        'backup.on': string;
        'backup.off': string;
        'cleanup.auto': string;
        'cleanup.auto.on': string;
        'cleanup.auto.off': string;
        'cleanup.maxAge': string;
        'cleanup.maxAge.hint': string;
        'cleanup.invalid': string;
        'cleanup.overridden': string;
        'cleanup.reset': string;
        'cleanup.save': string;
        'cleanup.saving': string;
        'cleanup.saveFailed': string;
        'cleanup.readonly': string;
        'cleanup.unavailable': string;
    };
    zh: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    ja: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    es: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    fr: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    de: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    ru: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
    pt: Record<"backup.off" | "backup.on" | "backup.title" | "button.aria" | "button.retract.aria" | "button.title" | "cleanup.auto" | "cleanup.auto.off" | "cleanup.auto.on" | "cleanup.invalid" | "cleanup.maxAge" | "cleanup.maxAge.hint" | "cleanup.overridden" | "cleanup.readonly" | "cleanup.reset" | "cleanup.save" | "cleanup.saveFailed" | "cleanup.saving" | "cleanup.unavailable" | "popover.back" | "popover.backupDisabled" | "popover.both" | "popover.both.hint" | "popover.cancel" | "popover.chat" | "popover.chat.hint" | "popover.checking" | "popover.confirm" | "popover.impact.delete" | "popover.impact.failed" | "popover.impact.loading" | "popover.impact.none" | "popover.impact.restore" | "popover.noChanges" | "popover.noText" | "popover.retract.hint" | "popover.retract.target" | "popover.retract.title" | "popover.title", string>;
};
