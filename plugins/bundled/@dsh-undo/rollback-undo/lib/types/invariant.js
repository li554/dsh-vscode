/** Package-owned invariant companion for rollback-undo. */
const PACKAGE_NAME = '@dsh-undo/rollback-undo';
/** Cordis companion plugin name. */
export const name = 'rollback-undo-invariant';
/** Service required before this companion registers its ownership record. */
export const inject = ['invariants'];
/** No runtime invariant: JSON journals and private Git trees have no authoritative live relation to compare. */
const install = Object.assign(() => { }, { inject: ['conversationUndo'] });
/** Register the package invariant companion. */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//# sourceMappingURL=invariant.js.map