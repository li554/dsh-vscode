import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PluginSettingsCard, ValueField, BooleanField, ChoiceField } from "./PluginSettingsCard.js";
import { CardForm, booleanField, choiceField, numberField } from "./settings-form.js";
import sectionCss from './settings-section.module.css';
/** Fetch the registry list (the same data the sprite renders from). */
async function fetchPetChoices() {
    const response = await fetch('/api/pet/pets');
    if (!response.ok)
        throw new Error('pet pets failed: ' + response.status);
    return (await response.json());
}
/** Fetch the registry diagnostics (v1 migration hints, invalid entries). */
async function fetchPetDiagnostics() {
    const response = await fetch('/api/pet/diagnostics');
    if (!response.ok)
        throw new Error('pet diagnostics failed: ' + response.status);
    const body = (await response.json());
    return body.diagnostics ?? [];
}
/** Bridges the 'pet' scope onto the card's staged form. */
export class PetSettingsCardController {
    form;
    store;
    // The choice list rides a mutable array shared with the choiceField spec,
    // so loading the registry re-validates and re-formats the petId field
    // without rebuilding the form.
    petChoices = [];
    petLabels = new Map();
    diagnostics = [];
    loaded = false;
    attempts = 0;
    disposed = false;
    /** Pending deferred-load or retry timer; cancelled by dispose(). */
    pendingTimer;
    /** @param scope - the bound settings scope for the 'pet' namespace. */
    constructor(scope) {
        this.form = new CardForm(scope, [
            booleanField('enabled'),
            booleanField('decorationEnabled'),
            booleanField('visible'),
            numberField('size'),
            numberField('right'),
            numberField('bottom'),
            choiceField('petId', this.petChoices),
        ]);
        this.store = this.form.bind(() => this.projection());
        // Client plugins are applied synchronously during shell startup. Defer
        // the first registry request until that pass completes so transport
        // plugins (notably remote-web-ui on a paired non-loopback origin) can
        // install their fetch channel before /api/pet/pets is issued.
        this.pendingTimer = window.setTimeout(() => {
            this.pendingTimer = undefined;
            if (this.disposed)
                return;
            void this.loadPets();
            void this.loadDiagnostics();
        }, 0);
    }
    /** Fetch registry diagnostics once (soft-fail: an empty list on error). */
    async loadDiagnostics() {
        try {
            this.diagnostics = await fetchPetDiagnostics();
            if (this.disposed)
                return;
            this.store.set(this.projection());
        }
        catch {
            this.diagnostics = [];
        }
    }
    /** Resolve the registry choices once (retried a few times on failure). */
    async loadPets() {
        if (this.loaded || this.disposed)
            return;
        try {
            const list = await fetchPetChoices();
            if (this.disposed)
                return;
            this.petChoices.splice(0, this.petChoices.length, ...list.map(choice => choice.id));
            for (const choice of list)
                this.petLabels.set(choice.id, choice.displayName);
            this.loaded = true;
            this.store.set(this.projection());
        }
        catch {
            if (this.disposed)
                return;
            this.attempts += 1;
            if (this.attempts < 3) {
                this.pendingTimer = window.setTimeout(() => {
                    this.pendingTimer = undefined;
                    if (this.disposed)
                        return;
                    void this.loadPets();
                }, 3000);
            }
        }
    }
    projection() {
        return {
            ...this.form.shell(),
            enabled: this.form.field('enabled'),
            decorationEnabled: this.form.field('decorationEnabled'),
            visible: this.form.field('visible'),
            size: this.form.field('size'),
            right: this.form.field('right'),
            bottom: this.form.field('bottom'),
            petId: this.form.field('petId'),
            petChoices: this.petChoices.map(id => ({ value: id, label: this.petLabels.get(id) ?? id })),
            petDiagnostics: this.diagnostics,
        };
    }
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot and its form actions.
     */
    inject() {
        return { hooks: { petSettingsCard: this.store }, ...this.form.actions() };
    }
    /**
     * Release the card's scope subscription, bound stores and pending load
     * timers; the slot disposer calls this on teardown.
     */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.pendingTimer !== undefined) {
            window.clearTimeout(this.pendingTimer);
            this.pendingTimer = undefined;
        }
        this.form.dispose();
    }
}
/**
 * Render the pet settings card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function PetSettingsCard(props) {
    const { t } = props;
    const state = props.usePetSettingsCard(snapshot => snapshot);
    const disabled = !state.writable;
    const fieldProps = {
        overriddenLabel: t('settings.overridden'),
        resetLabel: t('settings.reset'),
        invalidLabel: t('settings.invalidNumber'),
        disabled,
    };
    return (_jsxs(PluginSettingsCard, { t: t, titleKey: "settings.title", descriptionKey: "settings.description", state: state, onSave: props.save, onDiscard: props.discard, alwaysOpen: true, children: [_jsx(BooleanField, { id: "settings-pet-enabled", label: t('settings.enabled'), hint: t('settings.enabledHint'), inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'), ...fieldProps, ...state.enabled, onEdit: (text) => { props.edit('enabled', text); }, onReset: () => { props.resetField('enabled'); } }), _jsx(BooleanField, { id: "settings-pet-decoration", label: t('settings.decoration'), hint: t('settings.decorationHint'), inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'), ...fieldProps, ...state.decorationEnabled, onEdit: (text) => { props.edit('decorationEnabled', text); }, onReset: () => { props.resetField('decorationEnabled'); } }), _jsx(ChoiceField, { id: "settings-pet-pet", label: t('settings.pet'), hint: t('settings.petHint'), inheritLabel: t('settings.inherit'), ...fieldProps, ...state.petId, choices: state.petChoices, onEdit: (text) => { props.edit('petId', text); }, onReset: () => { props.resetField('petId'); } }), state.petDiagnostics.length === 0 ? null : (_jsxs("li", { className: sectionCss.diagnostics, "data-dsh-part": "diagnostics", children: [_jsx("span", { className: sectionCss.diagnosticsTitle, children: t('settings.diagnosticsTitle') }), _jsx("ul", { children: state.petDiagnostics.map((diagnostic, index) => (_jsx("li", { "data-level": diagnostic.level, children: diagnostic.message }, index))) })] })), _jsx(BooleanField, { id: "settings-pet-visible", label: t('settings.visible'), hint: t('settings.visibleHint'), inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'), ...fieldProps, ...state.visible, onEdit: (text) => { props.edit('visible', text); }, onReset: () => { props.resetField('visible'); } }), _jsx(ValueField, { id: "settings-pet-size", label: t('settings.size'), hint: t('settings.sizeHint'), numeric: true, ...fieldProps, ...state.size, onEdit: (text) => { props.edit('size', text); }, onReset: () => { props.resetField('size'); } }), _jsx(ValueField, { id: "settings-pet-right", label: t('settings.right'), hint: t('settings.rightHint'), numeric: true, ...fieldProps, ...state.right, onEdit: (text) => { props.edit('right', text); }, onReset: () => { props.resetField('right'); } }), _jsx(ValueField, { id: "settings-pet-bottom", label: t('settings.bottom'), hint: t('settings.bottomHint'), numeric: true, ...fieldProps, ...state.bottom, onEdit: (text) => { props.edit('bottom', text); }, onReset: () => { props.resetField('bottom'); } })] }));
}
/** Render the pet settings card as a first-level settings page. */
export function PetSettingsSection(props) {
    const { t, usePetSettingsCard, save, discard, edit, resetField } = props;
    return (_jsx("ul", { className: sectionCss.sectionList, children: _jsx(PetSettingsCard, { t: t, usePetSettingsCard: usePetSettingsCard, save: save, discard: discard, edit: edit, resetField: resetField }) }));
}
