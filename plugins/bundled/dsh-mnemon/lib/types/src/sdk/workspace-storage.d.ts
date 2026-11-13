/** Local workspace identity, including aliases with not-yet-created descendants. */
export declare function canonicalWorkspacePath(workspacePath: string): string;
/** A rename or move selects a new directory; resolving identity never writes. */
export declare function workspaceStorageId(workspacePath: string): string;
