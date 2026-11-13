import type { JSX } from 'react';
import { type MemoryPersistenceStrategy } from '../contracts.ts';
import type { MemorySpacesPageClient } from './api.ts';
export interface MemoryPlacementSettings {
    setPath(path: string[], value: unknown): Promise<void>;
}
export interface MemoryPlacementPageConfig {
    persistenceStrategy?: MemoryPersistenceStrategy;
}
export declare function PersistenceStrategyDialog(props: {
    client: MemorySpacesPageClient;
    settingsScope: MemoryPlacementSettings;
    config: MemoryPlacementPageConfig | undefined;
    writable: boolean;
    agentAvailable: boolean;
    onClose: () => void;
}): JSX.Element;
