/**
 * Skill collection: filesystem scanning (primary) plus registry supplement.
 *
 * The web profile mounts the skill-filesystem provider only at the agent
 * preset scope layer, so the host plane cannot read project/user skills from
 * ctx.skills — the list route scans the official root conventions itself and
 * merges registry entries (bundled / runtime) by name.
 */
/** Display order and copy for each source level. */
export interface SourceGroup {
    key: string;
    title: string;
    hint: string;
}
/** Source levels produced by filesystem scanning (registry sources map to the same set). */
export declare const SOURCE_GROUPS: SourceGroup[];
/** Registry source -> display level mapping (unlisted sources fall into "other"). */
export declare const REGISTRY_SOURCE_LEVEL: ReadonlyMap<string, string>;
/** One skill entry as served to the panel. */
export interface SkillEntry {
    name: string;
    description: string;
    whenToUse?: string;
    provider?: string;
    level: string;
    path?: string;
    /** True when the skill was discovered through a symlink entry (deletion is not allowed). */
    linked?: boolean;
    modelInvocable: boolean;
    userInvocable: boolean;
}
/** Registry snapshot entry shape (subset of ctx.skills entries). */
export interface RegistrySkill {
    name: string;
    description: string;
    whenToUse?: string;
    provider?: string;
    source: string;
    resourceBase?: {
        kind: string;
        path?: string;
    };
    invocation?: {
        modelInvocable?: boolean;
        userInvocable?: boolean;
    };
}
/** Options for collectSkills. */
export interface CollectOptions {
    /** Registry snapshot workspace base. */
    cwd: string;
    /** Project roots to scan (each scans .dsh/skills and .agents/skills). */
    projectRoots?: string[];
    /** Extra custom skill roots. */
    customSkillDirs?: string[];
    /** User dsh config root (~/.dsh). */
    dshHome: string;
    /** User agents config root (~/.agents). */
    agentsHome: string;
    /** ctx.skills registry (snapshot). */
    registry: {
        snapshot(options: {
            cwd: string;
        }): Promise<{
            skills: RegistrySkill[];
            complete: boolean;
        }>;
    };
}
/** Result of a collection pass. */
export interface CollectResult {
    skills: SkillEntry[];
    complete: boolean;
}
/** Group payload served by the list route. */
export interface GroupPayload {
    key: string;
    title: string;
    hint: string;
    skills: SkillEntry[];
}
/** List payload served by the list route. */
export interface ListPayload {
    cwd: string;
    projectRoots: string[];
    complete: boolean;
    groups: GroupPayload[];
}
/** Find the nearest ancestor directory containing .git (cwd itself when none). */
export declare function findProjectRoot(cwd: string): string;
/** Group by level, ordered by SOURCE_GROUPS then leftovers, sorted by name inside each group. */
export declare function buildPayload(skills: SkillEntry[], complete: boolean, cwd: string, projectRoots: string[]): ListPayload;
/**
 * Collect grouped skills: filesystem scanning (primary) + registry supplement.
 * Filesystem entries win on name conflicts; the registry fills whenToUse and
 * invocation flags, and contributes bundled/runtime entries of its own.
 * @param options - collection options.
 * @returns skills and whether the registry snapshot was complete.
 */
export declare function collectSkills(options: CollectOptions): Promise<CollectResult>;
/** Build the new skill file content (create route). */
export declare function buildSkillContent(name: string, description: string, whenToUse: string | undefined, content: string, disabled: boolean): string;
/** Create a skill file (mkdir -p + write). Returns the absolute target path. */
export declare function writeSkillFile(baseDir: string, name: string, description: string, whenToUse: string | undefined, content: string): Promise<string>;
/** Move a skill file into its .trash sibling directory (recoverable delete). */
export declare function trashSkillFile(path: string): Promise<string>;
/** User skill root convention. */
export declare function userSkillRoot(dshHome: string): string;
/** Project skill root convention (project root + .dsh/skills). */
export declare function projectSkillRoot(projectRoot: string): string;
