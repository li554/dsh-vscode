/**
 * dsh-desktop-launcher — host half. Serves the loopback-only
 * /api/dsh-desktop-launcher/create route that writes the launcher script
 * under $DSH_HOME/desktop-launcher/ and places a double-click icon on the
 * Desktop (Windows .lnk, macOS .command, Linux .desktop), and the
 * loopback-only /api/dsh-desktop-launcher/shutdown route that requests the
 * host process to exit gracefully. Also provides a system-prompt
 * announcement. The browser half (./client) renders the settings card with
 * the "create desktop icon" button and the floating shutdown trigger.
 * Everything rides official NPM SDK packages — no dsh source changes.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Bounded process-exit request provided by the dsh launcher. */
        appExit?: (code: number) => void;
    }
}
/** Stable cordis plugin name. */
export declare const name = "desktop-launcher";
/** Services required before the launcher surfaces can mount. */
export declare const inject: string[];
/**
 * Settings namespace of the desktop-launcher capability — the section the
 * web settings surface edits. Spelled here rather than imported so the
 * browser half can spell the same value without depending on a Host package.
 */
export declare const DESKTOP_LAUNCHER_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
    /** When true (default), a system-prompt section announces the plugin. */
    announceToAgent?: boolean;
    /** Master switch for the plugin; off by default. */
    enabled?: boolean;
    /** Command that starts dsh (must be on PATH when the launcher runs). */
    dshCommand?: string;
    /** Base URL of the dsh web GUI. */
    url?: string;
    /** Optional profile started as `dsh --profile <profile> --no-open`. */
    profile?: string;
    /** Optional icon file (.ico/.png) for the desktop icon; empty uses the bundled dsh icon. */
    iconPath?: string;
    /** Whether the floating shutdown button asks for confirmation before exiting. */
    confirmShutdown?: boolean;
}
export declare const Config: z<Config>;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
export declare const DESKTOP_LAUNCHER_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-desktop-launcher \u63D2\u4EF6\uFF08DSH \u684C\u9762\u542F\u52A8\u5668 + \u4E00\u952E\u5173\u673A\uFF09\uFF1A\u8BBE\u7F6E \u2192 \u63D2\u4EF6\u914D\u7F6E \u2192 Web UI \u63D2\u4EF6 \u5361\u7247\u5185\u300C\u521B\u5EFA\u684C\u9762\u56FE\u6807\u300D\u53EF\u5728\u684C\u9762\u751F\u6210\u4E00\u952E\u542F\u52A8\u56FE\u6807\uFF08Windows .lnk / macOS .command / Linux .desktop\uFF09\uFF0C\u53CC\u51FB\u5373\u542F\u52A8 dsh web \u5E76\u6253\u5F00 Web GUI\uFF1B\u53EF\u914D\u7F6E dshCommand / url / profile\u3002\u754C\u9762\u53F3\u4E0B\u89D2\u8FD8\u6709\u5173\u673A\u6837\u5F0F\u6D6E\u52A8\u6309\u94AE\uFF0C\u70B9\u51FB\u5F39\u51FA\u786E\u8BA4\u6846\uFF0C\u786E\u8BA4\u540E\u8BF7\u6C42\u5BBF\u4E3B\u8FDB\u7A0B\u4F18\u96C5\u9000\u51FA\uFF08\u7ECF ctx.appExit\uFF0C\u5148\u56DE\u6536\u63D2\u4EF6\u6811\u518D\u9000\u51FA\uFF1B\u65E0 appExit \u65F6\u56DE\u9000 process.exit(0)\uFF09\u3002\u9650\u5236\uFF1A\u56FE\u6807\u521B\u5EFA\u4E0E\u5173\u673A\u8DEF\u7531\u5747\u4EC5\u9650 loopback\uFF0C\u9000\u51FA\u4F1A\u7EC8\u6B62 dsh web \u8FDB\u7A0B\uFF0C\u6B63\u5728\u8FD0\u884C\u7684\u4F1A\u8BDD/\u4EFB\u52A1\u53EF\u80FD\u4E2D\u65AD\u3002\u7528\u6237\u63D0\u5230\u300C\u684C\u9762\u56FE\u6807 / \u5FEB\u6377\u65B9\u5F0F / \u4E00\u952E\u542F\u52A8 dsh / \u5173\u673A / \u9000\u51FA DSH / \u5173\u95ED DeepSeek Harness\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
/**
 * Mount the route and announcement, gated on the composition entry config
 * (and the live settings value once the web settings surface is served).
 * @param ctx - host plugin context carrying webServer/systemPrompt.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: Config): void;
export {};
