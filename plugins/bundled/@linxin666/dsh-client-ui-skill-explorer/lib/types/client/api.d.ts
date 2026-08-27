/**
 * Skill center API client (browser half). Talks to the host route family over
 * same-origin fetch; the host enforces the trust fence on its side.
 */
/** One skill entry as served by the host. */
export interface SkillEntry {
    name: string;
    description: string;
    whenToUse?: string;
    provider?: string;
    level: string;
    path?: string;
    /** True for skills discovered through a symlink entry (deletion not allowed). */
    linked?: boolean;
    modelInvocable: boolean;
    userInvocable: boolean;
}
/** Group payload served by the host. */
export interface GroupPayload {
    key: string;
    title: string;
    hint: string;
    skills: SkillEntry[];
}
/** List payload served by the host. */
export interface ListPayload {
    cwd: string;
    projectRoots: string[];
    complete: boolean;
    groups: GroupPayload[];
}
/** One thrown API error with the host-provided message. */
export declare class ApiError extends Error {
}
/** Skill center API client. */
export declare class SkillApi {
    /** Fetch the grouped skill list. */
    list(): Promise<ListPayload>;
    /** Enable or disable a skill (rewrites disable-model-invocation). */
    setEnabled(name: string, path: string, enabled: boolean): Promise<{
        name: string;
        enabled: boolean;
        modelInvocable: boolean;
        path?: string;
    }>;
    /** Create a skill file under the user or project root. */
    create(payload: {
        root: 'user' | 'project';
        name: string;
        description: string;
        whenToUse?: string;
        content: string;
        cwd: string;
    }): Promise<{
        ok: true;
        name: string;
        path: string;
    }>;
    /** Delete a skill (moves it into .trash). */
    remove(name: string, path: string): Promise<{
        ok: true;
        name: string;
        moved: string;
    }>;
    private request;
}
