import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PluginSettingsCard } from "./PluginSettingsCard.js";
import { CardForm } from "./settings-form.js";
import { SideCardPrefs } from "./SideCardPrefs.js";
import css from './settings-card.module.css';
import cardCss from './AionUiSettingsCard.module.css';
/** The external plugin the side card (right panel) comes from. */
export const SIDE_CARD_SOURCE_URL = 'https://github.com/omdsh-dev/DSH-better-sidebar';
/** Bridges the 'aionui-panel' scope onto the card's availability anchor. */
export class AionUiSettingsCardController {
    form;
    store;
    /** @param scope - the bound settings scope for the 'aionui-panel' namespace. */
    constructor(scope) {
        this.form = new CardForm(scope, []);
        this.store = this.form.bind(() => this.form.shell());
    }
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot and its form actions.
     */
    inject() {
        return { hooks: { aionUiSettingsCard: this.store }, ...this.form.actions() };
    }
    /**
     * Release the card's scope subscription and bound stores; the slot
     * disposer calls this on teardown.
     */
    dispose() {
        this.form.dispose();
    }
}
/**
 * Render the side-card card: the attribution line plus the embedded side
 * card preferences editor.
 * @param props - locale copy, the card snapshot, its form actions, and the
 *   external registry face.
 * @returns the card.
 */
export function AionUiSettingsCard(props) {
    const { t } = props;
    const state = props.useAionUiSettingsCard(snapshot => snapshot);
    return (_jsxs(PluginSettingsCard, { t: t, titleKey: "settings.title", descriptionKey: "settings.description", defaultOpen: false, hideFooter: true, state: state, onSave: props.save, onDiscard: props.discard, children: [_jsxs("p", { className: css.hint, children: [t('settings.sourcePrefix'), _jsx("a", { href: SIDE_CARD_SOURCE_URL, target: "_blank", rel: "noreferrer", children: "github.com/omdsh-dev/DSH-better-sidebar" }), t('settings.sourceSuffix')] }), _jsx("div", { className: cardCss.embeddedSection, children: _jsx(SideCardPrefs, { t: t, sidebar: props.sidebar }) })] }));
}
