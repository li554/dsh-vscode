import type { JSX } from 'react';
import type { RuntimePageClient } from './api.ts';
export declare function RuntimePage(props: {
    client: RuntimePageClient;
    revision: number;
    writeEnabled: boolean;
    focusText?: string;
    onRevealElement?(element: HTMLElement): void;
    onMutate: () => void;
}): JSX.Element;
