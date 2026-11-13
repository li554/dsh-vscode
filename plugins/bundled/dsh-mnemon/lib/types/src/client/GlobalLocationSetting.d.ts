import type { JSX, ReactNode } from 'react';
interface GlobalLocationSettingProps {
    name: string;
    ariaLabel: string;
    label: string;
    hint: ReactNode;
    defaultLabel: string;
    customLabel: string;
    custom: boolean;
    workspace: boolean;
    disabled: boolean;
    className?: string | undefined;
    children?: ReactNode;
    onChange: (custom: boolean) => void;
    onInteract?: (() => void) | undefined;
}
/** The default or custom location control: the storage directory, Native and workspace-aware providers. */
export declare function GlobalLocationSetting(props: GlobalLocationSettingProps): JSX.Element;
export {};
