/**
 * dsh-rewind client logger: a single, namespaced, level-filtered logging
 * channel for every browser-side diagnostic in this plugin.
 *
 * Design (industry-normal layering, kept dependency-free):
 * - `error` / `warn` are ALWAYS emitted (they are the anomaly guard: rare,
 *   cheap, and must surface even for a user who never touched the switch).
 * - `info` / `debug` are gated by a DEBUG switch and further filtered by
 *   namespace, so verbose detail never floods a normal user's console.
 *
 * The DEBUG switch is a runtime, per-origin knob read from
 * `localStorage['dsh-rewind.debug']` — the convention-debug-scan pattern
 * (namespace match, comma-separated, `*` wildcard), scoped to an
 * exclusively-own key so it can never enable any other plugin/feature and no
 * other feature can wake this one. Because it is read on every call (never
 * cached), flipping it and reloading takes effect on any published build
 * without a plugin rebuild.
 *
 * Values accepted by the switch (empty/unset = off):
 * - `dsh-rewind*`  — every dsh-rewind namespace.
 * - `dsh-rewind:refill` — just one subsystem (exact match).
 * - `dsh-rewind:refill,dsh-rewind:hiding` — several (comma-separated).
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
