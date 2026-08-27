/**
 * SKILL.md frontmatter lightweight parsing and rewriting (zero dependency).
 *
 * Ported from the local plugin family's shared implementation; the official
 * dsh-skill-filesystem provider parses frontmatter with its own stack, so
 * this module keeps a stable export surface for unit tests to lock behavior.
 */
/** Parse a YAML boolean (true/false/yes/no/on/off/1/0, case-insensitive); undefined when not boolean. */
export declare function parseYamlBool(value: unknown): boolean | undefined;
/** Parsed frontmatter fields consumed by the skill center. */
export interface Frontmatter {
    name?: string;
    description?: string;
    whenToUse?: string;
    hint?: string;
    recordInput?: boolean;
    disableModelInvocation?: boolean;
    userInvocable?: boolean;
}
/**
 * Parse scalar fields from the leading frontmatter block (lightweight, zero
 * dependency). Supports name/description/whenToUse (including | / > block
 * scalars), the input nested block (hint / recordInput) and the
 * disable-model-invocation / user-invocable booleans.
 * @param content - raw SKILL.md content.
 * @returns parsed fields (empty object when no frontmatter).
 */
export declare function parseFrontmatter(content: string): Frontmatter;
/**
 * Rewrite one boolean frontmatter field (appends when absent), atomically.
 * Preserves every other line and the body verbatim.
 * @param file - absolute SKILL.md path.
 * @param field - frontmatter field name (e.g. disable-model-invocation).
 * @param value - target boolean value.
 * @returns the parsed frontmatter of the rewritten content.
 */
export declare function setFrontmatterField(file: string, field: string, value: boolean): Frontmatter;
