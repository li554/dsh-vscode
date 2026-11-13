import type { JSX } from 'react';
import type { Insight, MemorySpaceProvider, MemorySpaceView, MemoryProviderConnection, MemoryProviderDescriptor, MemoryProviderId, MemoryReadSource } from '../contracts.ts';
import { type MnemonTranslate } from 'dsh-mnemon/client';
export type ProviderDrafts = Partial<Record<MemoryProviderId, MemoryProviderConnection>>;
export declare function mergeProviderDefaults(providers: readonly MemoryProviderDescriptor[], current: ProviderDrafts): ProviderDrafts;
export declare function providerDraftComplete(provider: MemoryProviderDescriptor | undefined, connection: MemoryProviderConnection | undefined): boolean;
/** Keep a ready provider; otherwise Mnemon Native while its CLI is available, then the first other ready one. */
export declare function readyProviderId(providers: readonly MemoryProviderDescriptor[], current?: MemoryProviderId): MemoryProviderId | undefined;
/** Ready Providers first, in catalog order, so the choices that work lead the list. */
export declare function readyFirst(providers: readonly MemoryProviderDescriptor[]): MemoryProviderDescriptor[];
/** Why a provider cannot be chosen: Mnemon Native needs its CLI, the others a service configured on the dsh-mnemon page under Plugins. */
export declare function providerUnavailableKey(provider: MemoryProviderDescriptor): 'overview.nativeCliRequired' | 'overview.providerServiceRequired';
export declare function nativeSpaceProvider(provider: MemorySpaceProvider): boolean;
/** Shared memory-level Provider form used by manual creation, editing, and distillation policy. */
export declare function ProviderMemoryFields(props: {
    provider: MemoryProviderDescriptor;
    connection: MemoryProviderConnection;
    onChange: (key: string, value: string | number | boolean) => void;
    body?: MemorySpaceView;
    clearSecrets?: string[];
    onClearSecretsChange?: (keys: string[]) => void;
}): JSX.Element;
export declare function categoryLabel(t: MnemonTranslate, category: string): string;
export declare function insightKey(insight: Insight): string;
export declare function MemoryProviderBadge(props: {
    providerId: MemoryProviderId;
    label: string;
}): JSX.Element;
export declare function ReadSourcePanel(props: {
    title: string;
    hint?: string;
    sources: readonly MemoryReadSource[];
    selectedBodyId?: string | undefined;
    onSelect?: (memoryBodyId: string | undefined) => void;
}): JSX.Element | null;
export declare function InsightCard(props: {
    insight: Insight;
    writeEnabled: boolean;
    onForget: (insight: Insight) => Promise<void>;
    onRelated?: (insight: Insight) => void;
    onClone?: (insight: Insight) => void;
}): JSX.Element;
/** @deprecated Use nativeSpaceProvider. */
export declare const nativeBodyProvider: typeof nativeSpaceProvider;
