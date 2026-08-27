/**
 * The /api/dsh-skill-explorer route family: list (grouped by source), set
 * enabled (rewrites SKILL.md frontmatter), create, delete (move to .trash)
 * and health. Every route carries the shared trust fence (loopback by
 * default; a live paired-device cookie is an extra allow path when
 * remote-web-ui is loaded) plus browser same-origin markers — the write
 * routes touch real skill files, so unpaired LAN clients must not reach them.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type CollectOptions } from './collect.ts';
/** Route paths (client bundle mirrors these literals; tests assert both sides). */
export declare const ROUTES: {
    readonly list: "/api/dsh-skill-explorer/list";
    readonly setEnabled: "/api/dsh-skill-explorer/set-enabled";
    readonly create: "/api/dsh-skill-explorer/create";
    readonly delete: "/api/dsh-skill-explorer/delete";
    readonly health: "/api/dsh-skill-explorer/health";
};
/** Route family dependencies (tests inject fakes). */
export interface SkillRoutesDeps {
    /** User dsh config root (~/.dsh). */
    dshHome: string;
    /** User agents config root (~/.agents). */
    agentsHome: string;
    /** Extra custom skill roots from plugin config. */
    customSkillDirs: string[];
    /** ctx.skills registry (snapshot). */
    registry: CollectOptions['registry'];
    /** Active session cwd list (project root base). */
    activeSessionCwds(): string[];
    /** Logger. */
    logger: {
        warn(error: unknown): void;
    };
}
/** Default process cwd fallback (overridable in tests). */
export declare const DEFAULT_CWD: () => string;
/**
 * Build every /api/dsh-skill-explorer route (exact paths).
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param deps - dshHome/agentsHome/registry/sessions.
 * @returns the route list for ctx.webServer.register.
 */
export declare function makeRoutes(ctx: Context, deps: SkillRoutesDeps): WebRoute[];
