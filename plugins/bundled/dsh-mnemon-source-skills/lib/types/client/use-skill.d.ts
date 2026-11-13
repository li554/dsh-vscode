/**
 * "Use" puts `/name ` into the conversation's input, where DSH's own gesture
 * loads the skill when the message is sent. The page and the composer meet
 * through one window event; the composer side answers by marking it handled.
 */
export declare const SKILL_USE_EVENT = "dsh-mnemon:skill-use";
/**
 * Ask the open composer to take `/name`. When the conversation is not on
 * screen yet, the request waits briefly for its composer to mount.
 * @returns whether a composer took it at once.
 */
export declare function requestSkillUse(name: string, sessionId?: string): boolean;
/** Where `/name` goes in a draft: first, once, ahead of what is already typed. */
export declare function draftWithSkill(draft: string, name: string): string;
interface ComposerInputActions {
    setDraft(text: string): void;
}
/** DSH's session-scoped composer props: the input selector and its stable actions. */
export interface SkillUseBridgeProps {
    sessionId?: string;
    inputActions?: ComposerInputActions;
    useInput?: <T>(selector: (state: {
        draft: string;
    }) => T) => T;
}
/** Mounted in the composer row; renders nothing and answers "Use" for its own session. */
export declare function SkillUseBridge(props: SkillUseBridgeProps): null;
export declare const SKILL_USE_SLOT = "conversation.input.left";
/**
 * Register the bridge in the composer's tool row once the conversation
 * declares that row; a host without it leaves "Use" untaken.
 */
export declare function installSkillUseBridge(ctx: {
    slots: unknown;
}): () => void;
export {};
