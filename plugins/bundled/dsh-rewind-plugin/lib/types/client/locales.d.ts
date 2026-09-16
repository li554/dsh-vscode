/** `rewind` namespace dictionaries for the client plugin. */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'button.aria': string;
    'button.title': string;
    'button.retract.aria': string;
    'button.retract.title': string;
    'popover.title': string;
    'popover.noText': string;
    'popover.retract.title': string;
    'popover.retract.target': string;
    'popover.retract.hint': string;
    'popover.retract.confirm': string;
    'popover.chat': string;
    'popover.chat.hint': string;
    'popover.both': string;
    'popover.both.hint': string;
    'popover.checking': string;
    'popover.noChanges': string;
    'popover.cancel': string;
    'popover.impact.loading': string;
    'popover.impact.failed': string;
    'popover.impact.none': string;
    'popover.impact.restore': string;
    'popover.impact.delete': string;
    'popover.confirm': string;
    'popover.back': string;
    'cleanup.title': string;
    'cleanup.desc': string;
    'cleanup.expand': string;
    'cleanup.collapse': string;
    'cleanup.unsaved': string;
    'cleanup.auto': string;
    'cleanup.auto.on': string;
    'cleanup.auto.off': string;
    'cleanup.maxAge': string;
    'cleanup.maxAge.hint': string;
    'cleanup.invalid': string;
    'cleanup.discard': string;
    'cleanup.save': string;
    'cleanup.saving': string;
    'cleanup.saved': string;
    'cleanup.saveFailed': string;
    'cleanup.readonly': string;
};
/** The rewind namespace key union. */
export type RewindKey = keyof typeof zh;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The in-place rewind controls' copy. */
        rewind: RewindKey;
    }
}
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'button.aria': string;
    'button.title': string;
    'button.retract.aria': string;
    'button.retract.title': string;
    'popover.title': string;
    'popover.noText': string;
    'popover.retract.title': string;
    'popover.retract.target': string;
    'popover.retract.hint': string;
    'popover.retract.confirm': string;
    'popover.chat': string;
    'popover.chat.hint': string;
    'popover.both': string;
    'popover.both.hint': string;
    'popover.checking': string;
    'popover.noChanges': string;
    'popover.cancel': string;
    'popover.impact.loading': string;
    'popover.impact.failed': string;
    'popover.impact.none': string;
    'popover.impact.restore': string;
    'popover.impact.delete': string;
    'popover.confirm': string;
    'popover.back': string;
    'cleanup.title': string;
    'cleanup.desc': string;
    'cleanup.expand': string;
    'cleanup.collapse': string;
    'cleanup.unsaved': string;
    'cleanup.auto': string;
    'cleanup.auto.on': string;
    'cleanup.auto.off': string;
    'cleanup.maxAge': string;
    'cleanup.maxAge.hint': string;
    'cleanup.invalid': string;
    'cleanup.discard': string;
    'cleanup.save': string;
    'cleanup.saving': string;
    'cleanup.saved': string;
    'cleanup.saveFailed': string;
    'cleanup.readonly': string;
};
