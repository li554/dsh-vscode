import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Native-image section of the describe-image card (rc.8 feature): reports
 * the current agent-default route's image-input state and toggles the
 * DeepSeek adapter catalog entry through the loopback host route. The
 * section is self-contained (its own fetch state) — it never rides the card
 * form, so a toggle settles immediately while the rest of the card keeps its
 * staged drafts. Unsupported hosts and failed writes render a hint; nothing
 * here throws.
 * @module @linxin666/dsh-tool-describe-image/client/NativeImageSection
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchNativeImageState, setNativeImageEnabled } from "./native-images.js";
import { t } from "./locales.js";
import cardCss from './settings-card.module.css';
import css from './probe.module.css';
/**
 * Render the native-image request section.
 * @returns the section block.
 */
export function NativeImageSection() {
    const [phase, setPhase] = useState('loading');
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState();
    const refresh = useCallback(() => {
        let alive = true;
        setPhase('loading');
        setError(undefined);
        void fetchNativeImageState().then((value) => {
            if (!alive)
                return;
            setState(value);
            setPhase(value === null ? 'failed' : 'ready');
        });
        const cancel = () => { alive = false; };
        cancel;
    }, []);
    useEffect(() => {
        refresh();
    }, [refresh]);
    const toggle = useCallback(() => {
        if (busy || state === null)
            return;
        setBusy(true);
        setError(undefined);
        void setNativeImageEnabled(!state.capability.acceptsImages).then((result) => {
            setBusy(false);
            if (result.ok && result.value !== undefined) {
                setState(result.value);
                setPhase('ready');
                return;
            }
            setError(result.message ?? 'failed');
        });
    }, [busy, state]);
    const enabled = state?.capability.acceptsImages === true;
    const canToggle = phase === 'ready' && state !== null && state.supported && state.model !== undefined && !busy;
    return (_jsxs("div", { className: cardCss.field, children: [_jsxs("div", { className: cardCss.head, children: [_jsx("label", { className: cardCss.label, htmlFor: "settings-describe-image-native-images", children: t('native.title') }), _jsx("button", { type: "button", id: "settings-describe-image-native-images", className: css.probeInline, disabled: !canToggle, onClick: toggle, children: busy ? t('native.busy') : enabled ? t('native.disable') : t('native.enable') })] }), phase === 'loading'
                ? _jsx("p", { className: cardCss.hint, children: t('native.loading') })
                : null, phase === 'ready' && state !== null
                ? (_jsx("p", { className: cardCss.hint, children: state.model === undefined
                        ? t('native.unknownModel')
                        : state.supported
                            ? enabled
                                ? t('native.enabled', { model: state.model })
                                : t('native.disabled', { model: state.model })
                            : t('native.unsupported') }))
                : null, phase === 'failed'
                ? _jsx("p", { className: cardCss.hint, children: t('native.unsupported') })
                : null, error !== undefined
                ? _jsx("p", { className: css.probeError, role: "status", children: t('native.failed', { error }) })
                : null] }));
}
