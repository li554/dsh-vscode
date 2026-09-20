import type { SshApi } from '../api.ts';
import { type TerminalFontSource } from './helpers.ts';
/** Terminal tab props. */
export interface TerminalTabProps {
    api: SshApi;
    /** Alias preselected by a "connect" action from the hosts tab. */
    presetAlias?: string;
    /** Monotonic id of the connect request (re-applies presetAlias). */
    requestId?: number;
    /**
     * Live terminal-font setting source (issue #577). Absent in tests and
     * legacy mounts: the font then comes from the CSS custom-property chain.
     */
    terminalFont?: TerminalFontSource;
}
/** The xterm terminal view. */
export declare function TerminalTab({ api, presetAlias, requestId, terminalFont }: TerminalTabProps): import("react").JSX.Element;
