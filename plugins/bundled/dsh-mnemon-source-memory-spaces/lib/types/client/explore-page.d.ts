import type { JSX } from 'react';
import { type Insight } from '../contracts.ts';
import type { MemorySpacesPageClient } from './api.ts';
export interface MemorySpacesPageStatus {
    defaultRecallLimit?: number;
}
export declare function ExplorePage(props: {
    client: MemorySpacesPageClient;
    agentClient: MemorySpacesPageClient;
    agentAvailable: boolean;
    status: MemorySpacesPageStatus | null;
    seed: string;
    writeEnabled: boolean;
    onForget: (insight: Insight) => Promise<void>;
    onRevealElement?(element: HTMLElement): void;
}): JSX.Element;
