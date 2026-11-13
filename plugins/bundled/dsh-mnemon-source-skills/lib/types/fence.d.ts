/** The frontmatter fence alone, free of the YAML parser so the browser page can use it. */
export interface SplitSkill {
    /** Frontmatter text between the fences, verbatim. */
    frontmatter: string;
    body: string;
    /** Offsets into the original text, so an edit can keep everything else byte for byte. */
    frontmatterStart: number;
    frontmatterEnd: number;
}
/** The same fence rules as `dsh-skill-filesystem`: `---` on the first line and on a later line of its own. */
export declare function splitFrontmatter(raw: string): SplitSkill | undefined;
