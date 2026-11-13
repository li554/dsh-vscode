/**
 * dsh-rewind client logger: one namespaced, level-filtered channel for every
 * browser-side diagnostic in this plugin.
 *
 * `error` / `warn` are ALWAYS emitted (the anomaly guard: rare, cheap, and
 * surfaced even for a user who never touched the switch). `info` / `debug` are
 * gated by the exclusively-own, per-origin `localStorage['dsh-rewind.debug']`
 * switch and further filtered by namespace. The switch is read on every call
 * (never cached), so flipping it and reloading takes effect on any published
 * build without a plugin rebuild.
 *
 * Values accepted (empty/unset = off): `dsh-rewind*` — every namespace;
 * `dsh-rewind:refill` — one subsystem (exact match);
 * `dsh-rewind:refill,dsh-rewind:visibility` — several (comma-separated).
 *
 * @module dsh-rewind/client/log
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
/**
 * Emit one diagnostic line. `error`/`warn` always print; `info`/`debug` print
 * only when the DEBUG switch selects the namespace. Both gated levels are
 * routed to the always-visible `console.info` rather than `console.debug`,
 * whose "Verbose" level Chrome filters out by default — otherwise a reporter
 * who turns the switch on still would not see the line without also changing
 * the DevTools level filter (mapped to `console.debug`). `data` is spread last
 * so DevTools' structured view keeps it inspectable (never stringified).
 */
export declare function log(level: LogLevel, scope: string, message: string, data?: unknown): void;
/** Convenience shorthands (typed so call sites read cleanly). */
export declare const rewindLog: {
    readonly error: (scope: string, message: string, data?: unknown) => void;
    readonly warn: (scope: string, message: string, data?: unknown) => void;
    readonly info: (scope: string, message: string, data?: unknown) => void;
    readonly debug: (scope: string, message: string, data?: unknown) => void;
};
