/**
 * Send-to-Harness port for the dsh-doctor recovery console.
 *
 * The console composes a troubleshooting prompt from the newest recorded
 * failure (error summary plus stack) and hands it to this port, which the
 * client entry wires to the real DSH sessions service over ctx.sessions: the
 * prompt is queued into the CURRENT session (a fresh turn the user's agent
 * answers), never touching the console's own host state. The port is the only
 * browser-half seam that talks to the session domain; everything here is
 * framework-free and testable with a fake port.
 * @module @linxin666/dsh-doctor/client
 */
/** One target session the prompt may be sent into. */
export interface HarnessTarget {
    id: string;
    /** Human label: durable title, project basename, then session id. */
    label: string;
}
/** Settled outcome of a send. */
export type HarnessSendResult = {
    ok: true;
} | {
    ok: false;
    message: string;
};
/**
 * The port the console needs: current-session resolution plus prompt delivery.
 * The client entry implements it over ctx.sessions; tests use a fake.
 */
export interface HarnessPort {
    /** The currently open session, when any. */
    current(): HarnessTarget | undefined;
    /** Queue the prompt text into the target session. */
    send(target: HarnessTarget, text: string): Promise<HarnessSendResult>;
}
/** Facts of the newest failure the prompt is composed from. */
export interface HarnessFailureInput {
    /** One-line human summary. */
    summary: string;
    /** Kind label, when known. */
    kind?: string;
    /** Longer detail / stack excerpt; may be undefined. */
    stack?: string;
    /** Epoch ms of the failure. */
    at?: number;
}
/** Environment facts appended to the prompt. */
export interface HarnessPromptEnv {
    webVersion?: string;
    supervisorVersion?: string;
}
/**
 * Build the real port over ctx.sessions. Returns undefined when no sessions
 * service is provided (the console then degrades the send affordance).
 * @param sessions - the raw ctx.sessions value (unknown by design: the port
 *   is optional and must never make apply fail).
 */
export declare function createHarnessPort(sessions: unknown): HarnessPort | undefined;
/** Compose the troubleshooting prompt text (never throws). */
export declare function composeHarnessPrompt(failure: HarnessFailureInput, env: HarnessPromptEnv, lines: {
    title: string;
    summary: string;
    kind: string;
    stack: string;
    environment: string;
}): string;
