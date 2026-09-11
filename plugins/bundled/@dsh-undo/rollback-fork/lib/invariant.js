//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-undo/rollback-fork`.
* @module @dsh-undo/rollback-fork/invariant
*/
const PACKAGE_NAME = "@dsh-undo/rollback-fork";
/** Cordis companion plugin name. */
const name = "rollback-fork-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: an exact prefix cut has no live event relationship after the child is constructed. */
const install = Object.assign(() => {}, { inject: ["sessionFork"] });
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
