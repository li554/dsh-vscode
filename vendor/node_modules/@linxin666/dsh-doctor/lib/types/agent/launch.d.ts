/** Drop a leading program token (`dsh`, `dsh.cmd`, absolute executable path) so helpers work with or without it. */
export declare function normalizeArgv(argv: readonly string[]): readonly string[];
export declare function parseProfile(argv: readonly string[]): string | undefined;
export declare function classifyInvocation(argv: readonly string[]): 'profile' | 'plugin' | 'dump' | 'utility';
export declare function findRealDsh(env?: NodeJS.ProcessEnv, self?: string): string;
export interface ManagedLaunchOptions {
    argv: string[];
    endpoint: string;
    token: string;
    realDsh?: string;
    env?: NodeJS.ProcessEnv;
    now?: () => string;
}
export declare function managedLaunch(options: ManagedLaunchOptions): Promise<number>;
