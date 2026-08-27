/**
 * The describe-image settings card: the vision endpoint (base URL, model,
 * key reference), the default instruction, and the call bounds. Registers
 * into the `web-ui.plugin.item` slot the Web UI Plugins group renders,
 * bound to the `describe-image` settings namespace through the family
 * settings bridge (or the official settings scope when the deployment
 * exposes the namespace directly).
 * @module @linxin666/dsh-tool-describe-image/client/DescribeImageSettingsCard
 */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts';
/** The describe-image fields this card edits (the namespace's full schema). */
export interface DescribeImageSettings {
    baseURL?: string;
    model?: string;
    apiKey?: string;
    apiKeyEnv?: string;
    defaultPrompt?: string;
    maxBytes?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
    apiStyle?: 'chat-completions' | 'responses' | 'anthropic-messages';
    renderImagePreview?: boolean;
    interceptImageSend?: boolean;
}
/** The probe button's live state between clicks. */
export interface ProbeState {
    /** idle before the first click, running while a request crosses the wire. */
    status: 'idle' | 'running';
    /** Which action is running (or ran last), so the status line words itself. */
    pending?: 'fetch' | 'test';
    /** Model ids the last successful listing returned, in listing order. */
    models: string[];
    /** Round-trip milliseconds of the last successful model ping. */
    latencyMs?: number;
    /** The failure reason the last action surfaced; absent until one fails. */
    error?: string;
}
/** What the describe-image card renders. */
export interface DescribeImageSettingsCardState extends CardShell {
    baseURL: CardFieldState;
    model: CardFieldState;
    apiKey: CardFieldState;
    apiKeyEnv: CardFieldState;
    defaultPrompt: CardFieldState;
    maxBytes: CardFieldState;
    maxOutputTokens: CardFieldState;
    timeoutMs: CardFieldState;
    apiStyle: CardFieldState;
    renderImagePreview: CardFieldState;
    interceptImageSend: CardFieldState;
    probe: ProbeState;
}
/** The registration-side face the card's slot entry injects. */
export interface DescribeImageSettingsCardFace extends CardActions {
    /** List the endpoint's models against the card's current connection drafts. */
    fetchModels: () => void;
    /** Ping the selected model once and report its round-trip latency. */
    testModel: () => void;
    hooks: {
        /** Card snapshot bound by the renderer as useDescribeImageSettingsCard. */
        describeImageSettingsCard: SnapshotStore<DescribeImageSettingsCardState>;
    };
}
/** Bridges the `describe-image` scope onto the card's staged form. */
export declare class DescribeImageSettingsCardController {
    private readonly form;
    private readonly store;
    private probeState;
    private disposed;
    /** @param scope - the bound settings scope for the `describe-image` namespace. */
    constructor(scope: SettingsScope<DescribeImageSettings>);
    /**
     * List the endpoint named by the card's current drafts. Drafts ride the
     * request so an unsaved endpoint can be verified before saving; the key
     * never crosses into the browser. A failed listing drops any stale list.
     */
    fetchModels(): void;
    /**
     * Ping the selected model once: one minimal completion call whose
     * round-trip latency is the model's own first-response time. Hidden until
     * the model field carries a value; the listing stays while it runs.
     */
    testModel(): void;
    /** Re-emit the projection; a probe settling publishes outside scope changes. */
    private publish;
    private projection;
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot and its form actions.
     */
    inject(): DescribeImageSettingsCardFace;
    /**
     * Release the card's scope subscription and bound stores; the slot
     * disposer calls this on teardown. A request still in flight settles into
     * nothing once disposed.
     */
    dispose(): void;
}
/** Props the renderer binds for the describe-image card. */
export type DescribeImageSettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & InjectFace<DescribeImageSettingsCardFace>;
/**
 * Render the describe-image card.
 * @param props - the card snapshot and its form actions.
 * @returns the card.
 */
export declare function DescribeImageSettingsCard(props: DescribeImageSettingsCardProps): import("react").JSX.Element;
//# sourceMappingURL=DescribeImageSettingsCard.d.ts.map