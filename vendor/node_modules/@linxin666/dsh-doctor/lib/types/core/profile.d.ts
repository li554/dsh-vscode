import type { ProfileIdentity } from './protocol.ts';
export declare function assertSafeProfileName(name: string): string;
export declare function resolveDshHome(env?: NodeJS.ProcessEnv, home?: string, cwd?: string): string;
export declare function profileIdentity(dshHome: string, name: string, dshExecutable: string, role?: 'protected' | 'rescue'): ProfileIdentity;
export declare function profileDir(identity: Pick<ProfileIdentity, 'dshHome' | 'name'>): string;
