//#region lib/types/invariant.js
/** Package-owned invariant companion for client-rollback-button. */
const PACKAGE_NAME = "@dsh-undo/client-rollback-button";
/** Cordis companion plugin name. */
const name = "client-rollback-button-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: the button mirrors Host journal state with no independent live relation. */
const install = Object.assign(() => {}, { inject: [] });
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
