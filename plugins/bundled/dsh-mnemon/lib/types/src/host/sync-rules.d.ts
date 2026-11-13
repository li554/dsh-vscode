/**
 * The rules a Git sync setting meets, shared by the settings form, which checks a field as the user
 * types it, and the Host, which checks what it saves and what it reads back. They import nothing,
 * so the browser bundle takes them too; each side keeps its own messages.
 */
/** The longest name an installation carries; a host name past it is shortened. */
export declare const MNEMON_MACHINE_LABEL_MAX = 120;
/** A Git branch name: no revision syntax, no empty path segment, no trailing dot or lock suffix. */
export declare function syncBranchValid(name: string): boolean;
/** The parts of a directory inside the branch, or undefined when it is not one: relative, with no `.`, `..` or drive. */
export declare function syncDirectoryParts(value: string): string[] | undefined;
/** What is wrong with a repository address. */
export type MnemonSyncRepositoryProblem = 'format' | 'credentials';
/**
 * What is wrong with a repository address, or nothing for an https:// or ssh:// URL without
 * credentials in it, a git@host:path address, or a local path that `localPath` takes. An HTTPS
 * address may name the user a host wants its token offered under, as Bitbucket's do, but never a
 * password, nor a token written where that name goes.
 */
export declare function syncRepositoryProblem(url: string, localPath: (path: string) => boolean): MnemonSyncRepositoryProblem | undefined;
/**
 * A local path that is absolute on POSIX or on Windows, for the browser, which cannot tell which
 * platform the Host runs on: a POSIX path, a Windows path on a drive, or a UNC share. The Host
 * checks a path by its own platform's rule instead.
 */
export declare function portableAbsolutePath(path: string): boolean;
/** A commit author's address. */
export declare function syncEmailValid(email: string): boolean;
/** A name for this machine, as it is stored and shown: one line of at most MNEMON_MACHINE_LABEL_MAX characters. */
export declare function machineLabelValid(label: string): boolean;
/** A GitHub repository name, as GitHub accepts one. */
export declare function githubRepositoryNameValid(name: string): boolean;
