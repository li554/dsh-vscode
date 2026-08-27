/**
 * Loopback /api/doctor HTTP client for the dsh-doctor recovery console.
 *
 * Wire contract owned by the Host half (host/routes.ts):
 * - GET  /api/doctor/status        -> DoctorSupervisorResponse (snapshot)
 * - POST /api/doctor/action        -> DoctorSupervisorResponse (body { action, profileId?, incidentId? })
 * - POST /api/doctor/client-failure -> DoctorSupervisorResponse (body { message, stack?, phase?, runId? })
 *
 * Every method resolves, never rejects. A disabled host half (404 or a 200 SPA
 * fallback page), a 403 fence refusal and a supervisor business failure all
 * degrade to structured errors instead of unhandled rejections. The fetch seam
 * accepts a narrow response interface so tests run in node or jsdom.
 * @module @linxin666/dsh-doctor/client
 */
import type { DoctorActionName, DoctorSupervisorResponse } from './doctor-types.ts';
/** Narrow response shape the client reads (global fetch Response satisfies it). */
export interface DoctorHttpResponse {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
    text(): Promise<string>;
}
/** Narrow fetch signature; override in tests. */
export type DoctorFetch = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}) => Promise<DoctorHttpResponse>;
/** Failure taxonomy of one endpoint call. */
export type DoctorApiFailureKind = 'network' | 'loopback' | 'not-available' | 'malformed' | 'http' | 'supervisor' | 'unprovisioned' | 'supervisor-down';
/** Successful verdict of one endpoint call. */
export type DoctorApiOk<T> = {
    ok: true;
    value: T;
};
/** Failed verdict of one endpoint call. */
export type DoctorApiFail = {
    ok: false;
    kind: DoctorApiFailureKind;
    status?: number;
    message?: string;
    code?: string;
};
/** Result of one endpoint call (never a rejected promise). */
export type DoctorApiResult<T> = DoctorApiOk<T> | DoctorApiFail;
/** Base path of the doctor API (same-origin, fenced to loopback host-side). */
export declare const DOCTOR_API_BASE = "/api/doctor";
/**
 * Validate a SupervisorResponse body. Returns undefined on malformed input;
 * the response keeps its business ok flag so callers can distinguish a
 * supervisor refusal from a transport failure.
 */
export declare function parseSupervisorResponse(value: unknown): DoctorSupervisorResponse | undefined;
/**
 * Loopback API client. Pass a fetch seam in tests; the browser default calls
 * the page's global fetch with the DOCTOR_API_BASE prefix.
 */
export declare class DoctorApi {
    private readonly fetch;
    private readonly base;
    constructor(deps?: {
        fetch?: DoctorFetch;
        base?: string;
    });
    /** GET /api/doctor/status (supervisor snapshot). */
    status(): Promise<DoctorApiResult<DoctorSupervisorResponse>>;
    /** POST /api/doctor/action: run a supervisor action by name. */
    action(name: DoctorActionName, selection?: {
        profileId?: string;
        incidentId?: string;
    }): Promise<DoctorApiResult<DoctorSupervisorResponse>>;
    /** POST /api/doctor/client-failure: report a browser-side failure. */
    reportClientFailure(input: {
        message: string;
        stack?: string;
        phase?: string;
        runId?: string;
    }): Promise<DoctorApiResult<DoctorSupervisorResponse>>;
    private post;
    private request;
}
