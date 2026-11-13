import type { JSX } from 'react';
import { type Insight } from '../contracts.ts';
import type { MemorySpacesPageClient } from './api.ts';
export declare function ListPage(props: {
    client: MemorySpacesPageClient;
    revision: number;
    writeEnabled: boolean;
    onForget: (insight: Insight) => Promise<void>;
    onClone: (insight: Insight) => void;
    onExplore: (query: string) => void;
}): JSX.Element;
