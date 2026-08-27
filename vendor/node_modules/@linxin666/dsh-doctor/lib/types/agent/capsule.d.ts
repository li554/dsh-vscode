import type { DoctorPaths } from './paths.ts';
export interface CapsuleManifest {
    schemaVersion: 1;
    createdAt: string;
    dshExecutable: string;
    dshVersion: string;
    doctorPackage: string;
    doctorVersion?: string;
    /** Relative paths of mirrored credential/config files inside rescue-home. */
    credentialsMirror?: string[];
    /** Sha256 over the mirrored source files; also drives capsule staleness. */
    credentialsFingerprint?: string;
    credentialsAt?: string;
    rescueHome: string;
    status: 'staging' | 'verified' | 'failed';
}
export interface CapsuleOptions {
    paths: DoctorPaths;
    dshExecutable: string;
    doctorSpec: string;
    doctorPackageDir?: string;
    doctorVersion?: string;
    /** Real DSH home whose provider/credential config is mirrored into the capsule. */
    sourceHome?: string;
    /** Profile name under the source home (default web). */
    sourceProfile?: string;
    /** Mirror known credential files into the capsule (default true). */
    mirrorCredentials?: boolean;
    now?: () => string;
    run?: typeof run;
}
/**
 * Known credential-bearing file names mirrored into the rescue profile so the
 * isolated environment can actually run providers after a crash. Only the
 * canonical names are mirrored; backup variants (name.bak-*) are never copied.
 */
export declare const CREDENTIAL_BASENAMES: readonly ["settings.yaml", ".credentials.yaml", "credentials.yaml", "credentials.yml", ".env"];
/** Candidate mirror paths relative to the DSH home. */
export declare function credentialRelPaths(sourceProfile: string): string[];
/** Copy every existing credential-bearing file into the rescue home (0600). */
export declare function mirrorCredentialFiles(options: {
    sourceHome: string;
    sourceProfile: string;
    targetHome: string;
}): Promise<string[]>;
/** Sha256 fingerprint of the credential-bearing source files (sorted by path). */
export declare function credentialsFingerprint(sourceHome: string, sourceProfile: string): Promise<string>;
/** Remove the mirrored credential files recorded in the capsule manifest (best effort). */
export declare function removeCapsuleCredentialFiles(paths: DoctorPaths): Promise<{
    removed: number;
}>;
declare function run(command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs?: number): Promise<{
    code: number;
    stdout: string;
    stderr: string;
}>;
export declare function provisionCapsule(options: CapsuleOptions): Promise<CapsuleManifest>;
export declare function capsuleFingerprint(paths: DoctorPaths): Promise<string>;
export {};
