import type { MemoryComponentHost } from 'dsh-mnemon/client';
import type { MemoryProviderServiceCatalog, MemoryProviderServiceView, MnemonEmbeddingFill, MnemonEmbeddingStatus, UpdateMemoryProviderServiceRequest } from '../contracts.ts';
/**
 * What these settings ask of the Host, through the operations dsh-mnemon
 * serves Memory Spaces on its configuration page.
 */
export interface MemorySpacesSettingsClient {
    /** Whether the Host finds the Mnemon CLI that Mnemon Native runs. */
    statusSummary(): Promise<{
        commandFound: boolean;
    }>;
    providerServices(): Promise<MemoryProviderServiceCatalog>;
    updateProviderService(request: UpdateMemoryProviderServiceRequest): Promise<MemoryProviderServiceView>;
    embeddingStatus(): Promise<MnemonEmbeddingStatus>;
    /** Fill in the vectors a Mnemon Native space lacks (#392). */
    fillEmbeddings(memoryBodyId: string): Promise<MnemonEmbeddingFill>;
}
type Operations = NonNullable<MemoryComponentHost['operations']>;
export declare function memorySpacesSettingsClient(operations: Operations): MemorySpacesSettingsClient;
export {};
