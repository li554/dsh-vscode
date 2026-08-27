import type { RedactionHit, RedactionResult, RedactionRule } from './types.ts';
/**
 * Default rule set. Covers DSH profile secret placement: settings documents,
 * credentials files, .env entries, MCP header values, provider keys, and the
 * dump-config output (which prints home patch configs verbatim, including
 * 'Authorization: Token ...' headers).
 */
export declare function defaultRules(): RedactionRule[];
/** Whether a key name matches any key rule. */
export declare function matchesKeyRules(name: string, rules: RedactionRule[]): string | undefined;
/**
 * Redact one value: returns the value unchanged when no rule matches, else
 * the deterministic marker. Object/array values are redacted deeply.
 */
export declare function redactValue(value: unknown, rules?: RedactionRule[], hits?: RedactionHit[]): unknown;
/**
 * Text redaction used for settings, patch, and dump documents: key-value
 * lines redact by key; then whole-text value patterns run over the joined
 * document so multi-line matches (private key blocks) are covered too.
 */
export declare function redactText(text: string, rules?: RedactionRule[]): RedactionResult;
/** Redact a structured object (dumps, parsed settings) and return the result. */
export declare function redactObject(value: unknown, rules?: RedactionRule[]): {
    value: unknown;
    fingerprint: string;
    hits: RedactionHit[];
};
/** Fingerprint of an already-redacted text (no re-redaction). */
export declare function fingerprintText(text: string): string;
/** Fingerprint of a redacted structured value. */
export declare function fingerprintObject(value: unknown): string;
/** Replace every occurrence of a home prefix with a symbolic placeholder. */
export declare function anonymizeHome(text: string, home: string): string;
