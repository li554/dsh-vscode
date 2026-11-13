/**
 * The ways skills are published that the market reads, and what a pasted
 * string most likely names. Pure, so the page can say what it will add
 * before anything is fetched.
 */
/**
 * - `catalog`: this market's own JSON format, curated, with both languages
 * - `well-known`: a site's Agent Skills discovery index (`/.well-known/agent-skills/`)
 * - `github`: every `SKILL.md` in a GitHub repository, plugin marketplaces included
 * - `search`: an index searched as the user types; its entries are never listed whole
 */
export type MarketSourceKind = 'catalog' | 'well-known' | 'github' | 'search';
export interface DetectedSource {
    /** `json` until the file is read: a catalog, or a discovery index, or a plugin marketplace on GitHub. */
    kind: 'catalog' | 'well-known' | 'github' | 'json';
    /** What the Source stores: a canonical GitHub URL, a URL, or an absolute path. */
    location: string;
    /** How the page names it: `owner/repo`, a host, or a file name. */
    label: string;
}
/** A GitHub repository, its ref and a folder in it, from `owner/repo` or any of its github.com URLs. */
export interface GithubLocation {
    repo: string;
    ref?: string;
    path: string;
}
export declare function githubUrl(location: GithubLocation): string;
/** Read a GitHub location back from what {@link githubUrl} stored, or from what a user pasted. */
export declare function parseGithub(input: string): GithubLocation | undefined;
/**
 * What a pasted string names, without fetching it: a GitHub repository
 * (`owner/repo`, a github.com URL, or a skills.sh page of one), a JSON file
 * by URL, a website that may publish an Agent Skills index, or an absolute
 * path to a local catalog. Undefined when it is none of these.
 */
export declare function detectSource(input: string): DetectedSource | undefined;
