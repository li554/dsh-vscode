/**
 * The component rows the Starter's bundle patch (cordis.patch.yml) declares,
 * in its order: each row's id and the package it names. DSH lists them under
 * the bundle's page. Tests keep this list equal to that patch and to the
 * versions package.json pins.
 */
export declare const STARTER_COMPONENT_ROWS: ReadonlyArray<{
    rowId: string;
    packageName: string;
}>;
/** The three enhancements the Starter ships switched off, in the order the Host suggests them for installation. */
export declare const STARTER_ENHANCEMENT_PACKAGES: readonly string[];
/**
 * The shipped packages that carry a bundle patch of their own, so that one
 * installed alone registers its row itself: the enhancements and the General
 * strategy. Under the Starter its rows own them, so a profile that also linked
 * them as separate bundles would declare those ids twice. A literal, not a
 * spread of the list above, so that a bundle that does not use it drops it.
 */
export declare const STARTER_SELF_REGISTERING_PACKAGES: readonly string[];
