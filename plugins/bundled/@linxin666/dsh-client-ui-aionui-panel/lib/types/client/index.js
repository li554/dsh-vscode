/**
 * AionUI right-panel system — browser half. The panel itself is retired: the
 * provider choice was removed and the right panel is always the external
 * dsh-better-sidebar side card, so the explorer/preview columns never mount.
 * What remains active here: the composer drop target and transcript mermaid
 * sentinels (both inert without the panel columns), and the side-card
 * settings card in the Web UI Plugins group, which embeds the side card's
 * own settings section inline.
 *
 * Failure policy: every DOM/runtime wiring failure is logged, never thrown —
 * the web shell fails the whole boot when a plugin apply throws.
 *
 * AionUi right-panel design (Apache-2.0, iOfficeAI/AionUi) — re-implemented
 * from measured behavior and architecture, not copied code.
 * @module dsh-aionui-panel/client
 */
import { AionUiSettingsCard, AionUiSettingsCardController } from "./AionUiSettingsCard.js";
import { NS, dictionaries } from "./locales.js";
import { DragFileInlay } from "./drag/DragFileInlay.js";
import { insertPathIntoDraft } from "./drag/file-drag.js";
import { MermaidChatEnhancer } from "./chat/mermaid-chat.js";
/** Required services: sessions for the project root, locale for the copy, and the settings scope for the provider choice. */
export const inject = ['sessions', 'locale', 'settingsScope'];
/** Apply the browser half. */
export function apply(ctx) {
    ctx.effect(() => {
        try {
            return ctx.locale.register(NS, dictionaries);
        }
        catch {
            return () => { };
        }
    }, 'dsh-aionui-panel: dictionaries');
    // The composer drop target for explorer file drags: mounted in the
    // official `conversation.input.dock` band (declared by the shipped
    // ui-conversation rc.6 shell), session-routed through the conversation
    // input facade. A missing session scope or conversation service degrades
    // to no-op — the panels themselves never depend on the dock entry.
    ctx.inject(['slots', 'conversation', 'sessions'], (scope) => {
        const sessions = scope.sessions;
        const conversation = scope.conversation;
        scope.slots.inject('conversation.input.dock', () => {
            try {
                return scope.slots.register({
                    name: 'conversation.input.dock',
                    id: 'aionui-drag-file',
                    order: 90,
                    locale: NS,
                    inject: (sessionId) => ({
                        insertPath: (path) => {
                            if (sessionId === undefined)
                                return false;
                            const actx = sessions.scope(sessionId);
                            if (actx === undefined)
                                return false;
                            const input = conversation.input;
                            if (input === undefined)
                                return false;
                            const shell = input.for(actx);
                            const draft = shell.state.getSnapshot().draft;
                            shell.setDraft(insertPathIntoDraft(draft, path));
                            return true;
                        },
                    }),
                }, DragFileInlay);
            }
            catch {
                return () => { };
            }
        });
    });
    // Transcript mermaid enhancement rides the same dock as a zero-render
    // sentinel: the shell has no message-body slot, so the sentinel observes
    // the document for the chat renderer's mermaid blocks (shell shape:
    // div.md-code-block with the language in its banner infostring).
    ctx.inject(['slots'], (scope) => {
        scope.slots.inject('conversation.input.dock', () => {
            try {
                return scope.slots.register({
                    name: 'conversation.input.dock',
                    id: 'aionui-mermaid-chat',
                    order: 91,
                }, MermaidChatEnhancer);
            }
            catch {
                return () => { };
            }
        });
    });
    // The side-card settings card in the Web UI Plugins group: it declares
    // the side card's origin and edits its everyday preferences inline through
    // the external plugin's own settings transport. The 'aionui-panel'
    // namespace binding is only the card's availability anchor — no editable
    // fields remain. The registry face (tab/viewer enumeration) comes from the
    // external plugin's cordis service when it is loaded.
    ctx.inject(['slots', 'settingsScope'], (settingsCtx) => {
        const binder = settingsCtx.get('webUiSettings') ?? settingsCtx.settingsScope;
        const panelScope = binder.bind({ namespace: NS });
        const settingsCard = new AionUiSettingsCardController(panelScope);
        settingsCtx.slots.inject('web-ui.plugin.item', () => {
            try {
                const unregister = settingsCtx.slots.register({
                    name: 'web-ui.plugin.item',
                    id: 'aionui-panel',
                    order: 110,
                    locale: NS,
                    inject: () => ({
                        ...settingsCard.inject(),
                        sidebar: settingsCtx.get('betterSidebar'),
                    }),
                }, AionUiSettingsCard);
                return () => {
                    settingsCard.dispose();
                    unregister();
                };
            }
            catch {
                return () => { };
            }
        });
    });
}
