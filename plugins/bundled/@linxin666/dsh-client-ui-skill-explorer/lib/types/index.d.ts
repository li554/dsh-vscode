/**
 * skill-explorer — host half. Serves the skill center data source: the
 * /api/dsh-skill-explorer route family (list grouped by source, set enabled,
 * create, delete, health) over the shared trust fence (loopback by default;
 * a live paired-device cookie is an extra allow path). The browser half
 * (./client) renders the skill center panel.
 *
 * Ported from the local dsh-skill-explorer plugin; everything rides official
 * NPM SDK packages — no dsh source changes.
 */
import type { Context } from '@deepseek-ai/cordis';
import { ROUTES } from './routes.ts';
/** Stable cordis plugin name. */
export declare const name = "skill-explorer";
/** Services required before the skill center routes can mount. */
export declare const inject: string[];
/** Route paths (re-exported for the client contract check). */
export { ROUTES };
/** Plugin config. */
export interface Config {
    /** Master switch for the plugin (routes). */
    enabled?: boolean;
    /** Extra custom skill root directories. */
    customSkillDirs?: string[];
    /** User dsh config root override (defaults to $DSH_HOME or ~/.dsh). */
    dshHome?: string;
    /** User agents config root override (defaults to $DSH_AGENTS_HOME or ~/.agents). */
    agentsHome?: string;
}
/**
 * Mount the skill center routes (trust fence looks up remoteWebUiPairing on ctx).
 * @param ctx - host plugin context carrying webServer/skills/sessions.
 * @param config - resolved plugin config.
 */
declare function applyImpl(ctx: Context, config?: Config): void;
/**
 * Single-instance guard shared by the plugin family: the aggregate bundle
 * (dsh-web-ui-all) and a standalone install of this package can coexist in
 * one profile, so the second host apply must be a no-op instead of
 * re-registering the same routes and failing the boot.
 */
export declare const apply: typeof applyImpl;
