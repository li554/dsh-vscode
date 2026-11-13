import { type JSX } from 'react';
import type { MemoryProviderConfigField } from '../contracts.ts';
export interface ProviderFieldProps {
    field: MemoryProviderConfigField;
    value: string | number | boolean | undefined;
    /** The Provider keeps a saved credential for this field; it never comes back to the page. */
    saved: boolean;
    /** In a dialog, the saved credential is being cleared, so a required field needs a value again. */
    clearing?: boolean;
    disabled?: boolean;
    /**
     * `settings`, a service field on the configuration page; `dialog`, a space's
     * field in this Source's dialogs. Each draws a field and shows a saved
     * credential as it always has: the configuration page fills the field with a
     * mask that a typed value replaces, and can show what is typed; a dialog
     * leaves the field empty with a note and can clear the credential.
     */
    layout: 'settings' | 'dialog';
    onChange: (value: string | number | boolean) => void;
    /** Offers clearing the saved credential, in a dialog that edits a space. */
    onClearChange?: (clearing: boolean) => void;
}
/** One field of a Provider descriptor, wherever it is edited. */
export declare function ProviderField(props: ProviderFieldProps): JSX.Element;
