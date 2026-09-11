/**
 * Archive Tasks nav-glyph patch for the shared Settings shell.
 *
 * dsh's SettingsRoot maps nav icons from a hardcoded id set (models /
 * agent-presets / plugins); every other section id falls back to the settings
 * gear. The registry offers no icon field on `settings.section`, so this
 * plugin renders IconArchiveOutline20 from the host module table next to the
 * gear of its own nav row — the same mapping the fork's main-tree NAV_ICONS
 * fix installs, delivered client-side so npm-hosted dsh builds get it too.
 *
 * The row's children belong to the shell's React tree: the gear is only
 * hidden (never unlinked — removing it breaks React's diff and blanks the
 * label), and the archive clone is inserted as a foreign node React leaves
 * alone across re-renders.
 */
/**
 * Keep the Archive Tasks nav glyph patched for the lifetime of this plugin:
 * the Settings dialog mounts per open, and locale changes rewrite row labels,
 * so every mutation re-runs the idempotent scan.
 * @param label - Reads the current locale label of the section.
 * @returns Disposer that stops observing and drops the icon template.
 */
export declare function mountArchiveNavIconPatch(label: () => string): () => void;
//# sourceMappingURL=navIconPatch.d.ts.map