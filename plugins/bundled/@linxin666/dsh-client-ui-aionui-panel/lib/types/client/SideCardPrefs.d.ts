/**
 * The embedded side-card preferences editor. The external dsh-better-sidebar
 * plugin keeps its user preferences behind its own fenced /sidebar/api
 * settings routes (its settings namespace is not allowlisted on the official
 * settings RPC), so this editor reads and writes through the same transport
 * its own settings section uses: POST /sidebar/api/settings.get for the
 * initial document and revision, POST /sidebar/api/settings.update with a
 * revision-guarded merge patch per change. Changes apply immediately, the
 * same optimistic-then-settle behavior as the plugin's own section.
 *
 * Coverage is the everyday surface of the section page: the general group
 * (open by default, width, chat file opens, position compat) plus the
 * sidebar tab and file viewer enable switches, enumerated live from the
 * plugin's registry service. Niche per-feature settings (terminal font,
 * sandbox switches, strip height) stay in the 'dsh-better-sidebar'
 * namespace of ~/.dsh/settings.yaml.
 * @module @linxin666/dsh-client-ui-aionui-panel/client/SideCardPrefs
 */
/** The registry slice this editor reads from the external plugin's service. */
export interface SideCardRegistry {
    getTabs(): readonly {
        id: string;
        title: string | (() => string);
        hidden?: boolean;
    }[];
    getFileViewers(): readonly {
        id: string;
        title?: string | (() => string);
        exts: readonly string[];
    }[];
    subscribe(listener: () => void): () => void;
}
/**
 * Render the embedded side-card preferences editor.
 * @param props - the locale reader and the external plugin's registry
 *   (undefined while dsh-better-sidebar is not loaded).
 * @returns the editor, or the unavailable/loading note.
 */
/** The locale keys this editor reads (a subset of the card's dictionary). */
export type SideCardPrefsKey = 'settings.generalTitle' | 'settings.openByDefault' | 'settings.openByDefaultHint' | 'settings.width' | 'settings.widthHint' | 'settings.openPath' | 'settings.openPathHint' | 'settings.titleBar' | 'settings.titleBarHint' | 'settings.tabsTitle' | 'settings.viewersTitle' | 'settings.prefsLoading' | 'settings.prefsUnavailable' | 'settings.on' | 'settings.off';
export declare function SideCardPrefs(props: {
    t: (key: SideCardPrefsKey) => string;
    sidebar?: SideCardRegistry | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=SideCardPrefs.d.ts.map