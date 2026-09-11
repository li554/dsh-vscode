//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-undo/rollback-archive`.
* @module @dsh-undo/rollback-archive/invariant
*/
const PACKAGE_NAME = "@dsh-undo/rollback-archive";
/** Cordis companion plugin name. */
const name = "rollback-archive-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: the archive set is Host-owned and the tombstone list is plugin-private. */
const install = Object.assign(() => {}, { inject: ["sessionArchive"] });
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
