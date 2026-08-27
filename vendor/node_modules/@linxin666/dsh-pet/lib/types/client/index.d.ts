/**
 * dsh-pet browser half — mounts the selected pet as a global floating
 * surface and drives it from the host's same-origin '/api/pet/*' JSON
 * endpoints: fetch the registry list once, poll the host snapshot (~2 s),
 * forward interactions, persist drag positions. The pet is host-global (no
 * session dimension), so it mounts directly onto 'document.body' via a
 * single React root rather than a session-scoped slot — on the
 * new-conversation screen no session exists, and a dock-mounted pet would
 * vanish there (issue #48). When the pet is hidden the entry becomes a
 * fixed-position summon button.
 * @module @linxin666/dsh-pet/client
 */
import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services (sessions powers bubble-to-session navigation). */
export declare const inject: string[];
/** Re-exported for consumers that type against the injected face. */
export type { PetInjected, PetDockEntryProps } from './PetDockEntry.tsx';
export type { PetSpriteProps } from './PetSprite.tsx';
export type { PetUiState, PetFeedback } from './pet-store.ts';
export type { PetSettingsCardFace, PetSettingsCardState } from './PetSettingsCard.tsx';
export type { PetSettingsSectionProps } from './PetSettingsCard.tsx';
export type { PetDefinition } from '../registry.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
         * absent when that group plugin is not installed, so callers fall back to
         * the official settings scope.
         */
        webUiSettings?: {
            bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
        };
    }
}
/**
 * Client plugin body: register dictionaries, mount the global pet entry and
 * poll loop while the plugin is enabled, and seat the settings card as a
 * first-level settings section.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map