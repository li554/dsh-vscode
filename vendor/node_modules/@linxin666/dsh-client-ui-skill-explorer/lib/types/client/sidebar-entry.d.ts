/** Stable data attribute identifying the injected entry row. */
export declare const ENTRY_SELECTOR = "[data-dsh-skill-explorer-entry]";
/**
 * Mount the sidebar entry, waiting for the shell to render and self-healing
 * on later React re-renders.
 * @param onClick - opens the skill center overlay.
 * @returns disposer removing the entry and its observers.
 */
export declare function mountSidebarEntry(onClick: () => void): () => void;
