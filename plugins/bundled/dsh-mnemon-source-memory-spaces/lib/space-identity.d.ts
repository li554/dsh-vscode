//#region src/space-identity.d.ts
declare class MemorySpaceIdentity {
  #private;
  /** `parent` holds the short-lived copies a store is read from; dispose of the identity when done. */
  constructor(parent: string);
  /** The store's content identity, or the digest of its bytes when its content cannot be read. */
  of(bytes: Uint8Array): string;
  /** Whether `outer` holds every row `inner` holds; `outer` may have columns `inner` lacks. */
  contains(outer: Uint8Array, inner: Uint8Array): boolean;
  /**
   * `local` with the rows only `incoming` holds added to it, or undefined when the two cannot
   * merge: a row both hold differently, a table or column `local` lacks, or a store that cannot
   * be read. `local` itself comes back when it already holds everything.
   */
  merge(local: Uint8Array, incoming: Uint8Array): Uint8Array | undefined;
  /** Remove the short-lived copies the identity made. */
  dispose(): void;
}
//#endregion
export { MemorySpaceIdentity };