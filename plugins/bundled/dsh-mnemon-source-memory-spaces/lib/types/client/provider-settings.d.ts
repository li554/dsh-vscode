import { type JSX, type ReactNode } from 'react';
import type { MemorySpacesSettingsClient } from './settings-client.ts';
interface ProviderSettingsSectionProps {
    /** Absent while the page has no Host connection: nothing is read or written then. */
    client?: MemorySpacesSettingsClient | undefined;
    /** Where the list keeps the Providers it last read or saved: the host's store, which outlives a mount. */
    retained: Map<string, unknown>;
    workspaceLabel?: string;
    activeScope: 'global' | 'workspace';
    refreshKey: number;
    disabled: boolean;
    scopeChanging: boolean;
    /** Rendered first in the list; Settings puts Mnemon Native here as a peer of the others. */
    leading?: ReactNode;
    /** Why the other Providers cannot be listed now; they are not read while it is set. */
    blocked?: ReactNode;
    /** Whether it is not yet known if the Providers can be listed; they are read once it is. */
    pending?: boolean;
    /** Why the listed Providers cannot be switched; rendered above them. */
    notice?: ReactNode;
    /** A Provider was saved or switched, so pages that list Providers re-read them. */
    onChanged?: () => void;
}
/** The Providers that store Memory Spaces, one card each, with what their services need. */
export declare function ProviderSettingsSection(props: ProviderSettingsSectionProps): JSX.Element;
export {};
