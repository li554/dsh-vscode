/**
 * dsh-liangshen — LiangShen (梁神) agent preset plugin.
 *
 * Host half only: on startup it syncs the bundled `presets/` tree into the
 * harness-home agent-presets root (`~/.dsh/.agent-presets`), making the
 * LiangShen preset selectable for new sessions without copying files by hand.
 * The capability announcement is a system-prompt section that ships OFF by
 * default (`announceToAgent: false`) and can be enabled in the web settings
 * surface (plugin config) or the profile patch. No browser half, no routes,
 * no agent tools — the preset itself provides the tools.
 *
 * The preset is the "anchored-standard" idea shipped as a named mode: the
 * first model request sees only the builtin Minimal preset's exact two tools
 * (persistent `bash` plus `str_replace_editor`), and after the anchor the
 * wire switches to PTC Mode. Derived from
 * https://github.com/xiaobright/dsh-anchored-standard (MIT).
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Stable cordis plugin name. */
export declare const name = "liangshen";
/** Settings namespace of the plugin (the web settings surface edits it). */
export declare const LIANGSHEN_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Prompt assembly must exist before the announcement section can register. */
export declare const inject: string[];
/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
    /** Master switch: when false, neither sync nor announcement runs. */
    enabled?: boolean;
    /** When true, a system-prompt section announces the plugin (default false — keep prompts clean unless the user opts in). */
    announceToAgent?: boolean;
}
export declare const Config: z<Config>;
/** Model-facing announcement: plugin presence, principle, and limits. */
export declare const LIANGSHEN_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-liangshen \u63D2\u4EF6\uFF08\u6881\u795E\u6A21\u5F0F agent preset\uFF09\uFF1A\u65B0\u5EFA\u4F1A\u8BDD\u7684\u9884\u8BBE\u9009\u62E9\u5668\u4E2D\u53EF\u9009\u300C\u6881\u795E\u6A21\u5F0F\u300D\u3002\u539F\u7406\uFF1A\u4E24\u9636\u6BB5\u951A\u5B9A\u2014\u2014\u9996\u8F6E\u6A21\u578B\u8BF7\u6C42\u4EC5\u66B4\u9732\u5B98\u65B9 Minimal \u7CBE\u786E\u53CC\u5DE5\u5177\uFF08\u6301\u4E45 bash \u4E0E str_replace_editor\uFF0C\u6587\u4EF6\u5DE5\u5177\u7EE7\u627F\u5BBF\u4E3B\u6C99\u7BB1\uFF09\uFF0C\u53EA\u4FDD\u7559\u4E00\u884C persona\uFF0C\u6E05\u7A7A\u8FD0\u884C\u65F6\u4E0A\u4E0B\u6587\u5E76\u53EA\u653E\u884C\u767D\u540D\u5355\u6D88\u606F\uFF08\u7528\u6237\u76F4\u63A5\u6D88\u606F\u4E0E /goal \u81EA\u52A8\u8F6E\u6B21\uFF09\uFF0C\u951A\u5B9A Minimal \u63A8\u7406\u8F68\u8FF9\uFF1B\u664B\u5347\u53D7\u9996\u5757\u951A\u5B9A\u95E8\u63A7\uFF08\u9996\u5757\u5305\u542B we \u4E14\u65E0 let me\uFF0C\u56DB\u6B65\u515C\u5E95\uFF09\uFF0C\u65E0\u5DE5\u5177\u9996\u8F6E\u4F1A\u5728\u54CD\u5E94\u540E\u81EA\u52A8\u664B\u5347\uFF0C\u664B\u5347\u540E wire \u5207\u6362\u4E3A PTC Mode\uFF08\u5355\u4E00 run_code\uFF09\u5E76\u5728 persona \u8FFD\u52A0\u6240\u9009\u5DE5\u4F5C\u533A\u8DEF\u5F84\uFF0Cworkspace \u6307\u4EE4\u4E0E skill \u76EE\u5F55\u5728\u664B\u5347\u540E\u518D\u5EF6\u8FDF\u4E00\u6B65\u6CE8\u5165\u3002preset \u6587\u4EF6\u7531\u63D2\u4EF6\u7EF4\u62A4\u4E8E ~/.dsh/.agent-presets\uFF0C\u5347\u7EA7\u63D2\u4EF6\u65F6\u81EA\u52A8\u66F4\u65B0\uFF1B\u9ED8\u8BA4\u9884\u8BBE\u7531\u7528\u6237\u81EA\u884C\u9009\u62E9\u3002\u7528\u6237\u63D0\u5230\u300C\u6881\u795E\u6A21\u5F0F / \u951A\u5B9A\u6A21\u5F0F / anchored standard\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
export { dshHome } from './dsh-home.ts';
/** Absolute path of the bundled preset tree inside this package. */
export declare function bundledPresetsRoot(): string;
/**
 * Mount the plugin: sync bundled presets into the harness-home agent-presets
 * root, register the settings namespace (enabled / announceToAgent, live),
 * and announce through a system-prompt section when announceToAgent is on
 * (off by default).
 * @param ctx - host plugin context carrying systemPrompt.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: Config): void;
