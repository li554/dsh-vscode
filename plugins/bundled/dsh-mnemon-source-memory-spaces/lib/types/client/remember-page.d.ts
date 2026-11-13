import type { JSX } from 'react';
import { type MemorySpaceView } from '../contracts.ts';
import type { MemorySpacesPageClient } from './api.ts';
/** `embeddingManaged`, from this Source's status, words a memory saved without a vector; left out, the receipt keeps the caution. */
export declare function RememberPage(props: {
    client: MemorySpacesPageClient;
    agentAvailable: boolean;
    memoryBodies: MemorySpaceView[];
    writeEnabled: boolean;
    seed: string;
    embeddingManaged?: boolean | undefined;
    onMutate: () => void;
    onClose: () => void;
    onView?: () => void;
}): JSX.Element;
