import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The embedded side-card preferences editor. The external dsh-better-sidebar
 * plugin keeps its user preferences behind its own fenced /sidebar/api
 * settings routes (its settings namespace is not allowlisted on the official
 * settings RPC), so this editor reads and writes through the same transport
 * its own settings section uses: POST /sidebar/api/settings.get for the
 * initial document and revision, POST /sidebar/api/settings.update with a
 * revision-guarded merge patch per change. Changes apply immediately, the
 * same optimistic-then-settle behavior as the plugin's own section.
 *
 * Coverage is the everyday surface of the section page: the general group
 * (open by default, width, chat file opens, position compat) plus the
 * sidebar tab and file viewer enable switches, enumerated live from the
 * plugin's registry service. Niche per-feature settings (terminal font,
 * sandbox switches, strip height) stay in the 'dsh-better-sidebar'
 * namespace of ~/.dsh/settings.yaml.
 * @module @linxin666/dsh-client-ui-aionui-panel/client/SideCardPrefs
 */
import { useEffect, useId, useRef, useState } from 'react';
import { SelectField } from "./PluginSettingsCard.js";
import css from './settings-card.module.css';
import cardCss from './AionUiSettingsCard.module.css';
/** Display fallbacks while a field is absent from the settings document (mirrors the plugin's schema defaults). */
const PREFS_DEFAULTS = {
    openByDefault: false,
    defaultWidthPercent: 35,
    interceptOpenPath: true,
    titleBarCompat: false,
    tabsEnabled: {},
    viewersEnabled: {},
};
const WIDTH_MIN = 20;
const WIDTH_MAX = 60;
/** Validate one raw resolved document into the fields this editor renders; malformed fields fall back to defaults. */
function parsePrefs(value) {
    if (value === null || typeof value !== 'object')
        return { ...PREFS_DEFAULTS };
    const record = value;
    const bool = (key) => typeof record[key] === 'boolean' ? record[key] : PREFS_DEFAULTS[key];
    const map = (key) => {
        const raw = record[key];
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
            return {};
        const out = {};
        for (const [id, flag] of Object.entries(raw)) {
            if (typeof flag === 'boolean')
                out[id] = flag;
        }
        return out;
    };
    const width = typeof record.defaultWidthPercent === 'number' && Number.isFinite(record.defaultWidthPercent)
        ? Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(record.defaultWidthPercent)))
        : PREFS_DEFAULTS.defaultWidthPercent;
    return {
        openByDefault: bool('openByDefault'),
        defaultWidthPercent: width,
        interceptOpenPath: bool('interceptOpenPath'),
        titleBarCompat: bool('titleBarCompat'),
        tabsEnabled: map('tabsEnabled'),
        viewersEnabled: map('viewersEnabled'),
    };
}
/** POST one settings wire call and unwrap the envelope, mirroring the plugin's own api.call. */
async function call(method, payload) {
    const response = await fetch('/sidebar/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const parsed = await response.json().catch(() => null);
    if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
        throw new Error(parsed?.error?.message ?? 'HTTP ' + response.status);
    }
    return parsed.value;
}
/** One immediate-apply boolean row. */
function ToggleRow(props) {
    const id = useId();
    return (_jsxs("div", { className: css.field, children: [_jsx("div", { className: css.head, children: _jsx("label", { className: css.label, htmlFor: id, children: props.label }) }), _jsx(SelectField, { id: id, options: [
                    { value: 'true', label: props.onLabel },
                    { value: 'false', label: props.offLabel },
                ], value: props.value ? 'true' : 'false', disabled: false, invalid: false, onEdit: text => { props.onFlip(text === 'true'); } }), props.hint !== undefined ? _jsx("p", { className: css.hint, children: props.hint }) : null] }));
}
/** The width row: a number input committing on blur or Enter, clamped to the contract range. */
function WidthRow(props) {
    const [draft, setDraft] = useState(String(props.value));
    useEffect(() => { setDraft(String(props.value)); }, [props.value]);
    const commit = () => {
        const parsed = Number(draft);
        if (!Number.isFinite(parsed)) {
            setDraft(String(props.value));
            return;
        }
        const clamped = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(parsed)));
        setDraft(String(clamped));
        if (clamped !== props.value)
            props.onCommit(clamped);
    };
    return (_jsxs("div", { className: css.field, children: [_jsx("div", { className: css.head, children: _jsx("span", { className: css.label, children: props.label }) }), _jsx("input", { className: css.input, type: "text", inputMode: "numeric", "aria-label": props.label, value: draft, onChange: event => { setDraft(event.target.value); }, onBlur: commit, onKeyDown: event => { if (event.key === 'Enter')
                    commit(); } }), _jsx("p", { className: css.hint, children: props.hint })] }));
}
/** A descriptor's display title (a plain string or its localized thunk), id as the fallback. */
function descriptorTitle(descriptor) {
    const title = typeof descriptor.title === 'function' ? descriptor.title() : descriptor.title;
    return title !== undefined && title !== '' ? title : descriptor.id;
}
export function SideCardPrefs(props) {
    const { t } = props;
    const [prefs, setPrefs] = useState(null);
    const [failed, setFailed] = useState(false);
    const revisionRef = useRef(undefined);
    const inFlightRef = useRef(Promise.resolve());
    const [, setRegistryVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        call('settings.get', {}).then((view) => {
            if (cancelled)
                return;
            revisionRef.current = view.revision;
            setPrefs(parsePrefs(view.value));
        }).catch(() => {
            if (!cancelled)
                setFailed(true);
        });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (props.sidebar === undefined)
            return undefined;
        return props.sidebar.subscribe(() => { setRegistryVersion(version => version + 1); });
    }, [props.sidebar]);
    /** Optimistically apply one merge patch, then commit; a failed commit refetches the authoritative document. */
    const applyPref = (patch) => {
        const run = inFlightRef.current.then(async () => {
            const view = await call('settings.update', {
                patch: { ...patch },
                ...(revisionRef.current !== undefined ? { expectedRevision: revisionRef.current } : {}),
            });
            revisionRef.current = view.revision;
            setPrefs(parsePrefs(view.value));
        }).catch(async () => {
            // Revert to the server's truth: a rejected write never stays on screen.
            const view = await call('settings.get', {}).catch(() => null);
            if (view !== null) {
                revisionRef.current = view.revision;
                setPrefs(parsePrefs(view.value));
            }
        });
        inFlightRef.current = run.then(() => undefined, () => undefined);
        void run.catch(() => undefined);
        setPrefs(previous => previous === null ? previous : { ...previous, ...patch });
    };
    if (failed)
        return _jsx("p", { className: css.hint, role: "status", children: t('settings.prefsUnavailable') });
    if (prefs === null)
        return _jsx("p", { className: css.hint, role: "status", children: t('settings.prefsLoading') });
    const onLabel = t('settings.on');
    const offLabel = t('settings.off');
    // The settings inventory lists every registered tab type, including the
    // ones hidden from the + menu (editor, diff) — same as the plugin's own page.
    const tabs = props.sidebar?.getTabs() ?? [];
    const viewers = props.sidebar?.getFileViewers() ?? [];
    return (_jsxs("div", { children: [_jsx("div", { className: cardCss.groupTitle, children: t('settings.generalTitle') }), _jsx(ToggleRow, { label: t('settings.openByDefault'), hint: t('settings.openByDefaultHint'), value: prefs.openByDefault, onLabel: onLabel, offLabel: offLabel, onFlip: next => { applyPref({ openByDefault: next }); } }), _jsx(WidthRow, { label: t('settings.width'), hint: t('settings.widthHint'), value: prefs.defaultWidthPercent, onCommit: next => { applyPref({ defaultWidthPercent: next }); } }), _jsx(ToggleRow, { label: t('settings.openPath'), hint: t('settings.openPathHint'), value: prefs.interceptOpenPath, onLabel: onLabel, offLabel: offLabel, onFlip: next => { applyPref({ interceptOpenPath: next }); } }), _jsx(ToggleRow, { label: t('settings.titleBar'), hint: t('settings.titleBarHint'), value: prefs.titleBarCompat, onLabel: onLabel, offLabel: offLabel, onFlip: next => { applyPref({ titleBarCompat: next }); } }), tabs.length > 0
                ? (_jsxs("div", { children: [_jsx("div", { className: cardCss.groupTitle, children: t('settings.tabsTitle') }), tabs.map(tab => (_jsx(ToggleRow, { label: descriptorTitle(tab), value: prefs.tabsEnabled[tab.id] !== false, onLabel: onLabel, offLabel: offLabel, onFlip: next => { applyPref({ tabsEnabled: { ...prefs.tabsEnabled, [tab.id]: next } }); } }, tab.id)))] }))
                : null, viewers.length > 0
                ? (_jsxs("div", { children: [_jsx("div", { className: cardCss.groupTitle, children: t('settings.viewersTitle') }), viewers.map(viewer => (_jsx(ToggleRow, { label: descriptorTitle(viewer), hint: viewer.exts.length > 0 ? viewer.exts.join(' \u00b7 ') : undefined, value: prefs.viewersEnabled[viewer.id] !== false, onLabel: onLabel, offLabel: offLabel, onFlip: next => { applyPref({ viewersEnabled: { ...prefs.viewersEnabled, [viewer.id]: next } }); } }, viewer.id)))] }))
                : null] }));
}
