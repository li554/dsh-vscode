import { type DshLocale } from './presentation.ts';
import { type ReactNode } from 'react';
import { type MemoryComponentSettingsProps, type MemoryComponentUIContext } from 'dsh-mnemon/client';
/**
 * Whether dsh-mnemon yields the settings it keeps for Memory Spaces to these.
 * One that exports the priority it keeps them at promises both that they do
 * not collide with these and that it lends these `host`. dsh-mnemon 0.5.31 and
 * earlier draw them itself and lend nothing, so registering them there would
 * show a second, unworkable copy.
 */
export declare function yieldsComponentSettings(client: {
    readonly MNEMON_COMPONENT_FALLBACK_PRIORITY?: unknown;
}): boolean;
/** Memory Spaces' own settings on its page under Plugins: its Providers and the embedding Mnemon Native reads. */
export declare function installMemorySpacesSettings(ctx: MemoryComponentUIContext & {
    locale?: DshLocale | undefined;
}): () => void;
/**
 * Memory Spaces' own settings: the Providers that store its spaces, Mnemon
 * Native first with the embedding runtime only Native reads. They need what
 * dsh-mnemon lends them; without it they show nothing. With DSH's language
 * service they translate as dsh-mnemon drew them, through its language chain.
 */
export declare function MemorySpacesSettings(props: MemoryComponentSettingsProps & {
    locale?: DshLocale | undefined;
}): ReactNode;
