import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Pet sprite companion component — the browser half's centerpiece. Renders a
 * fixed-position floating sprite (React portal onto document.body), plays
 * the track matching the host animation snapshot, and exposes the
 * interaction surface: click to pet, hover panel with feed/rename/hide, drag
 * to reposition (persisted via setConfig). Everything visual comes from the
 * pet definition the host serves ('/api/pet/pets' + the state snapshot's
 * pet id), so one component renders every registry entry.
 * @module @linxin666/dsh-pet/client/PetSprite
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { framePosition, rowOfTrack, trimTrack } from "./spritesheet.js";
import { sequenceFrameAt } from "./sequences.js";
import { animationForPhase } from "../state.js";
import styles from './pet.module.css';
/** Clamp a drag offset inside the viewport with a margin. */
function clampOffset(value, max) {
    return Math.max(0, Math.min(max, value));
}
/**
 * The status decoration ornament (pet-center M5, #567). Renders the active
 * phase's frame segment as a CSS-background strip at a compact bubble
 * height; prefers-reduced-motion holds the segment's first frame, and a
 * missing or undecodable asset simply paints nothing (CSS background
 * failure) — the bubble text is never disturbed. The span is aria-hidden;
 * the bubble keeps its own semantics untouched.
 */
function StatusOrnament(props) {
    const { decoration, phase } = props;
    const segment = decoration.phases[phase];
    const shown = segment !== undefined && segment !== 'hide';
    const segmentKey = segment !== undefined && segment !== 'hide' ? segment.from + ':' + segment.to : 'none';
    const spanRef = useRef(null);
    const scale = 18 / decoration.cell.height;
    const frameWidth = Math.round(decoration.cell.width * scale);
    const stripWidth = decoration.columns * frameWidth;
    // Value-stable dependency key: the host serves a fresh DecorationView
    // object on every state poll (2 s), so the effect must not depend on the
    // object identity — otherwise each poll would cancel and restart the
    // frame loop and the animation would jump back to its first frame.
    const durationsKey = decoration.durations.join(',');
    useEffect(() => {
        if (segment === undefined || segment === 'hide')
            return;
        const el = spanRef.current;
        if (el === null)
            return;
        const position = (index) => (-index * frameWidth) + 'px 0px';
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        el.style.backgroundPosition = position(segment.from);
        // A single-frame segment (from === to) has nothing to animate: with
        // loop=true the wrap branch would reset index to the same frame and the
        // tick would keep rescheduling a no-op rAF forever. Settle on the one
        // frame instead — same as the reduced-motion static hold.
        if (reduceMotion || segment.from === segment.to)
            return;
        let timer = 0;
        let index = segment.from;
        let elapsed = 0;
        let last = performance.now();
        const tick = () => {
            const now = performance.now();
            const delta = now - last;
            last = now;
            elapsed += delta;
            const duration = decoration.durations[index] ?? 120;
            // The segment's frame rate (duration ms, typically 90-160) is far
            // below the rAF cadence, so a 60fps loop would spend ~90% of its
            // ticks doing nothing. Schedule by the remaining time to the next
            // frame instead — the ornament wakes once per frame, not once per
            // screen refresh. A late wake (background tab, jank) carries extra
            // elapsed time, so catch up every due frame like the sprite loop.
            if (elapsed >= duration) {
                do {
                    elapsed -= duration;
                    if (index < segment.to)
                        index += 1;
                    else if (decoration.loop)
                        index = segment.from;
                } while (elapsed >= duration);
                // Only advance the background when the frame actually changes.
                el.style.backgroundPosition = position(index);
            }
            // A non-looping segment settles on its last frame; stop scheduling
            // instead of repainting the same position every frame.
            if (!decoration.loop && index === segment.to)
                return;
            timer = window.setTimeout(tick, Math.max(1, duration - elapsed));
        };
        timer = window.setTimeout(tick, 0);
        return () => window.clearTimeout(timer);
    }, [shown, segmentKey, frameWidth, decoration.loop, durationsKey]);
    if (!shown)
        return null;
    return (_jsx("span", { ref: spanRef, "aria-hidden": "true", "data-dsh-pet-decoration": decoration.id, style: {
            display: 'inline-block',
            width: frameWidth,
            height: 18,
            marginRight: 6,
            verticalAlign: 'middle',
            flexShrink: 0,
            backgroundImage: 'url(' + decoration.entryUrl + ')',
            backgroundSize: stripWidth + 'px 18px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '0px 0px',
        } }));
}
/**
 * The floating pet. The spritesheet frame advances on requestAnimationFrame
 * with per-frame durations from the definition's tracks; the atlas image is
 * loaded once and the background position is written straight to the sprite
 * element (no per-frame React state).
 */
export function PetSprite(props) {
    const { snapshot, definition, display, feedback } = props;
    const spriteRef = useRef(null);
    const floatRef = useRef(null);
    const panelRef = useRef(null);
    // Whichever bubble surface is currently rendered (feedback, the session
    // stack, or the legacy status bubble) — only one exists at a time.
    const bubbleRef = useRef(null);
    const [imageReady, setImageReady] = useState(false);
    const [hovered, setHovered] = useState(false);
    // Multi-session bubble stack: collapsed by default (only the display
    // session's bubble + a '+N' badge), expanded on stack hover (peek) or by
    // tapping the badge (pinned, for touch). The display session's bubble
    // anchors the bottom of the stack and never moves when extras open above
    // it, so the pointer target cannot flicker.
    const [stackPeek, setStackPeek] = useState(false);
    const [stackPinned, setStackPinned] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [panelAbove, setPanelAbove] = useState(false);
    // Extra margin-bottom for the above-panel so it stacks clear of the
    // bubbles instead of overlapping them (both anchor at the sprite's top).
    const [panelLift, setPanelLift] = useState(0);
    const [nameDraft, setNameDraft] = useState('');
    // Explicit IME composition tracking: some input methods (WeChat IME on
    // Windows) report keydowns with isComposing === false mid-composition, so
    // the native flag alone is not a safe submit/cancel guard (#303).
    const composingRef = useRef(false);
    const [dragPos, setDragPos] = useState(null);
    const dragRef = useRef(null);
    const hideTimerRef = useRef(null);
    const frameRef = useRef({
        track: null,
        index: 0,
        elapsed: 0,
    });
    const cell = definition.cell;
    const columns = definition.columns;
    const rows = definition.rows;
    const tracks = definition.tracks;
    const sequences = definition.sequences;
    // Hover-panel chrome from the pet's voice pack (pet-center M4, issue
    // #677): every slot falls back to the i18n dictionary when unset. Stat
    // formats carry {rank}/{n}/{points} placeholders the host validated.
    const panel = definition.panel;
    const panelLabel = (slot, i18n) => panel?.labels?.[slot] ?? i18n;
    const panelStat = (slot, i18nKey, values) => {
        const format = panel?.stats?.[slot] ?? props.t(i18nKey, values);
        if (panel?.stats?.[slot] === undefined)
            return format;
        // The host whitelists {rank}/{n}/{points} in every stat slot, so a pack
        // format may reference any of them; substitute all three live values
        // (the slot's own value plus the siblings) instead of only the slot's.
        const all = {
            rank: snapshot?.affinity.rank ?? '?',
            n: snapshot?.treats.stocked ?? 0,
            points: snapshot?.affinity.points ?? 0,
        };
        let text = format;
        for (const [name, value] of Object.entries(all))
            text = text.replaceAll('{' + name + '}', String(value));
        return text;
    };
    const panelShows = (action) => panel?.actions === undefined || panel.actions.includes(action);
    // Load the atlas once; the definition carries the authoritative per-row
    // frame counts and per-track durations, so nothing else is fetched. A
    // custom visual (pet-center M3) replaces the atlas entirely.
    useEffect(() => {
        if (props.visual !== undefined)
            return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled)
                setImageReady(true);
        };
        img.src = definition.atlasUrl;
        return () => {
            cancelled = true;
            img.onload = null;
        };
    }, [definition.atlasUrl, props.visual]);
    // Frame loop: advance the current track and write background-position.
    // Offsets must be in SCALED coordinates (background-position applies to the
    // scaled background image), so the current sprite scale rides a ref that
    // the loop reads every tick. Under prefers-reduced-motion the sprite holds
    // its track's first frame instead of animating (presentation-only; the
    // animation state machine is untouched).
    const spriteScale = display.size / cell.height;
    const phase = snapshot?.phase ?? 'idle';
    const animation = snapshot?.animation ?? 'idle';
    const scaleRef = useRef(spriteScale);
    scaleRef.current = spriteScale;
    useEffect(() => {
        if (props.visual !== undefined)
            return;
        const reduceMotion = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        const sequence = animation === animationForPhase(phase) ? sequences?.[phase] : undefined;
        const leadAnimation = sequence?.[0] ?? animation;
        const row = rowOfTrack(leadAnimation);
        const track = trimTrack(tracks[leadAnimation], rows[row] ?? tracks[leadAnimation].frames.length);
        // Paint one static sprite frame up front either way, so the pet is never
        // blank while the loop heat-up runs.
        const leadCol = track.frames[0];
        const lead = framePosition(cell, row, leadCol, scaleRef.current);
        let lastPosStr = lead.x + 'px ' + lead.y + 'px';
        if (spriteRef.current !== null) {
            spriteRef.current.style.backgroundPosition = lastPosStr;
        }
        if (reduceMotion)
            return;
        let raf = 0;
        let last = performance.now();
        let sequenceElapsed = 0;
        const tick = (ts) => {
            const delta = ts - last;
            last = ts;
            if (sequence !== undefined) {
                sequenceElapsed += delta;
                const current = sequenceFrameAt(sequence, tracks, sequenceElapsed);
                const currentRow = rowOfTrack(current.animation);
                const currentTrack = trimTrack(tracks[current.animation], rows[currentRow] ?? tracks[current.animation].frames.length);
                const col = currentTrack.frames[current.frameIndex];
                const pos = framePosition(cell, currentRow, col, scaleRef.current);
                const posStr = pos.x + 'px ' + pos.y + 'px';
                if (posStr !== lastPosStr) {
                    lastPosStr = posStr;
                    if (spriteRef.current !== null) {
                        spriteRef.current.style.backgroundPosition = posStr;
                    }
                }
                raf = requestAnimationFrame(tick);
                return;
            }
            // row/track come from the effect scope: they were computed once above
            // and this effect re-runs when animation/tracks/rows change, so the
            // per-frame recompute (trimTrack slices fresh arrays) is pure waste.
            const st = frameRef.current;
            if (st.track !== animation) {
                st.track = animation;
                st.index = 0;
                st.elapsed = 0;
            }
            st.elapsed += delta;
            const maxIndex = track.frames.length - 1;
            while (st.elapsed >= (track.durations[st.index] ?? 0) && st.index < maxIndex) {
                st.elapsed -= track.durations[st.index] ?? 0;
                st.index += 1;
            }
            if (st.elapsed >= (track.durations[st.index] ?? 0)) {
                if (track.loop) {
                    st.elapsed = 0;
                    st.index = 0;
                }
                else {
                    st.index = maxIndex; // hold the final frame; the host switches tracks
                }
            }
            const col = track.frames[st.index];
            const pos = framePosition(cell, row, col, scaleRef.current);
            const posStr = pos.x + 'px ' + pos.y + 'px';
            if (posStr !== lastPosStr) {
                lastPosStr = posStr;
                if (spriteRef.current !== null) {
                    spriteRef.current.style.backgroundPosition = posStr;
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [animation, phase, cell, columns, rows, tracks, sequences, props.visual]);
    // Auto-clear the feedback bubble after its CSS animation. The callback
    // rides a ref so re-renders never reset the timer: the 2s poll rebuilds
    // `props` every tick, and depending on it would starve the timeout.
    const feedbackDoneRef = useRef(props.onFeedbackDone);
    feedbackDoneRef.current = props.onFeedbackDone;
    useEffect(() => {
        if (feedback === null)
            return;
        const timer = window.setTimeout(() => feedbackDoneRef.current(), 2600);
        return () => window.clearTimeout(timer);
    }, [feedback]);
    // Dragging: pointer events on the sprite; position is right/bottom based.
    // `draggedRef` records whether the pointer actually moved, so the browser's
    // trailing click (fired after pointerup) does not pet the sprite.
    const draggedRef = useRef(false);
    const clearHideTimer = () => {
        if (hideTimerRef.current !== null) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };
    // Clear any pending auto-hide timer on unmount: a stray callback after
    // teardown reads window through react-dom and failed CI runs with
    // "window is not defined" (slow-runner timing, PetSprite.test.tsx).
    useEffect(() => () => clearHideTimer(), []);
    const onPointerDown = (e) => {
        e.preventDefault();
        e.target.setPointerCapture?.(e.pointerId);
        const current = dragPos ?? { right: display.right, bottom: display.bottom };
        dragRef.current = { startX: e.clientX, startY: e.clientY, ...current };
        draggedRef.current = false;
        setHovered(false);
    };
    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (drag === null)
            return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4)
            draggedRef.current = true;
        const right = clampOffset(drag.right - dx, window.innerWidth - 40);
        const bottom = clampOffset(drag.bottom - dy, window.innerHeight - 40);
        setDragPos({ right, bottom });
    };
    const onPointerUp = () => {
        if (dragRef.current === null)
            return;
        dragRef.current = null;
        if (dragPos !== null)
            props.onDragEnd(dragPos.right, dragPos.bottom);
    };
    const pos = dragPos ?? { right: display.right, bottom: display.bottom };
    const spriteWidth = Math.round(cell.width * spriteScale);
    const spriteHeight = Math.round(cell.height * spriteScale);
    // Concurrent sessions share one bubble slot: only the display session
    // speaks by default, and the rest hide behind a '+N' badge until the stack
    // is hovered/pinned open. The legacy single 'bubble' is the fallback when
    // the host serves no per-session list. The hover panel normally sits below
    // the sprite, so the bubbles stay visible and clickable — no region swap.
    const sessionBubbles = snapshot?.sessions ?? [];
    const stackOpen = stackPeek || stackPinned;
    const collapsed = !stackOpen && sessionBubbles.length > 1;
    const visibleSessions = collapsed ? sessionBubbles.slice(0, 1) : sessionBubbles;
    const statusBubble = feedback === null && sessionBubbles.length === 0
        ? snapshot?.bubble
        : undefined;
    // The display session's inner whisper (碎碎念) — short inner-voice copy
    // woken by the model's output. Instead of a second bubble of its own, a
    // fresh whisper takes over the display session's bubble (the stack top, or
    // the single status bubble) and re-tints it, so the pet never wears two
    // voices at once. Interaction feedback takes over the whole bubble area
    // while it plays, so whispers yield to it like status copy.
    const whisper = feedback === null ? snapshot?.whisper : undefined;
    const bubblePresent = feedback !== null || sessionBubbles.length > 0 || statusBubble !== undefined || whisper !== undefined;
    const displayName = snapshot?.name ?? definition.displayName;
    // The host-served status decoration (M5, #567); absent = text-only bubbles.
    const decoration = snapshot?.decoration;
    // A settled session list can no longer stay pinned open.
    useEffect(() => {
        if (sessionBubbles.length <= 1)
            setStackPinned(false);
    }, [sessionBubbles.length]);
    useLayoutEffect(() => {
        if (!hovered) {
            setPanelAbove(false);
            setPanelLift(0);
            return;
        }
        const updatePanelPlacement = () => {
            const sprite = spriteRef.current;
            const panel = panelRef.current;
            if (sprite === null || panel === null)
                return;
            const availableBelow = window.innerHeight - sprite.getBoundingClientRect().bottom;
            const above = availableBelow < panel.getBoundingClientRect().height + 8;
            setPanelAbove(above);
            // The fallback above-placement shares the sprite's top edge with the
            // bubble(s); lift the panel by the bubble area's height so the two
            // never overlap (8px base gap + 6px clearance above the top bubble).
            const bubbleHeight = above ? bubbleRef.current?.getBoundingClientRect().height ?? 0 : 0;
            setPanelLift(bubbleHeight > 0 ? Math.ceil(bubbleHeight) + 14 : 0);
        };
        updatePanelPlacement();
        window.addEventListener('resize', updatePanelPlacement);
        return () => window.removeEventListener('resize', updatePanelPlacement);
    }, [hovered, renaming, pos.right, pos.bottom, display.size, bubblePresent, sessionBubbles.length, stackOpen, feedback]);
    const float = (_jsxs("div", { ref: floatRef, className: styles.float, style: { right: pos.right, bottom: pos.bottom, zIndex: 2147483000 }, onPointerEnter: () => {
            clearHideTimer();
            setHovered(true);
        }, onPointerLeave: (e) => {
            // The panel renders OUTSIDE the container's box (absolute, below
            // the sprite), so moving onto it fires pointerleave on the container.
            // Treat a target still inside the container's DOM (the overflowed
            // panel) as "still hovering"; otherwise give the pointer a short
            // grace period to reach the panel across the gap below the sprite.
            // The bridge ('.panel::after') keeps the pointer inside the hit
            // area, and the grace period covers a slow mouse crossing the
            // remaining sliver.
            const next = e.relatedTarget;
            if (next instanceof Node && floatRef.current?.contains(next))
                return;
            // Never auto-hide while the rename box is open: moving the pointer
            // onto an IME candidate window (an OS-level window outside the
            // webview) fires pointerleave, and unmounting the input mid-IME-
            // composition crashes some input methods / the renderer (#303).
            if (renaming)
                return;
            clearHideTimer();
            hideTimerRef.current = window.setTimeout(() => setHovered(false), 300);
        }, children: [_jsxs("div", { className: styles.spriteWrap, style: { width: spriteWidth, height: spriteHeight }, children: [_jsx("div", { ref: spriteRef, className: styles.sprite, style: {
                            width: spriteWidth,
                            height: spriteHeight,
                            ...(props.visual === undefined
                                ? {
                                    backgroundImage: imageReady ? 'url(' + definition.atlasUrl + ')' : undefined,
                                    backgroundSize: (cell.width * columns * spriteScale) + 'px ' + (cell.height * (definition.atlasRows ?? rows.length) * spriteScale) + 'px',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: '0 0',
                                }
                                : {}),
                            cursor: dragRef.current === null ? 'grab' : 'grabbing',
                        }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onClick: () => {
                            // A pointer sequence that moved (dragged) still fires a trailing
                            // click; skip the pet when that happened.
                            if (draggedRef.current)
                                return;
                            props.onPet();
                        }, role: "button", "aria-label": definition.displayName, children: props.visual }), _jsx("button", { type: "button", className: styles.closeButton, "aria-label": panelLabel('hide', props.t('pet.hide')), title: panelLabel('hide', props.t('pet.hide')), "data-testid": "pet-close", onPointerDown: (e) => {
                            // Keep the close control from starting a drag on the sprite.
                            e.stopPropagation();
                        }, onClick: (e) => {
                            // The close control sits beside the pet button; do not pet as a
                            // side effect of closing the overlay.
                            e.stopPropagation();
                            props.onHide();
                        }, children: "\u00D7" })] }), feedback !== null && (_jsx("div", { ref: bubbleRef, className: clsx(styles.bubble, feedback.kind === 'feed' ? styles.bubbleFeed : styles.bubblePet), children: feedback.text }, feedback.at)), feedback === null && (sessionBubbles.length > 0 || statusBubble !== undefined || whisper !== undefined) && (_jsxs("div", { ref: bubbleRef, className: styles.bubbleStack, onPointerEnter: () => setStackPeek(true), onPointerLeave: () => setStackPeek(false), children: [visibleSessions.map((session, index) => {
                        // The whisper rides the display session's bubble — the stack's
                        // primary entry (DOM-first, rendered bottom-most by the reversed
                        // column so it stays glued to the sprite when extras open above).
                        // The key swap restarts the entrance animation so the mood change
                        // reads as the bubble re-speaking.
                        const speaksWhisper = index === 0 && whisper !== undefined;
                        const bubble = (_jsxs("button", { type: "button", className: clsx(styles.bubble, styles.bubbleStatus, styles.bubbleClickable, speaksWhisper && styles.bubbleWhisper), title: props.t('pet.openSessionHint'), onClick: () => { props.onOpenSession(session.sessionId); }, children: [index === 0 && !speaksWhisper && decoration !== undefined && (_jsx(StatusOrnament, { decoration: decoration, phase: phase })), speaksWhisper ? whisper : session.bubble] }, speaksWhisper ? 'whisper:' + whisper : session.sessionId));
                        // The primary bubble carries the '+N' badge while other sessions
                        // hide behind it; the badge toggles the pinned (touch) expansion.
                        if (index !== 0 || sessionBubbles.length <= 1)
                            return bubble;
                        return (_jsxs("span", { className: styles.bubbleAnchor, children: [bubble, _jsx("button", { type: "button", className: styles.bubbleMore, title: stackOpen
                                        ? props.t('pet.collapseSessions')
                                        : props.t('pet.moreSessions', { n: sessionBubbles.length - 1 }), "aria-label": stackOpen
                                        ? props.t('pet.collapseSessions')
                                        : props.t('pet.moreSessions', { n: sessionBubbles.length - 1 }), "aria-expanded": stackOpen, onClick: (e) => {
                                        e.stopPropagation();
                                        setStackPinned(open => !open);
                                    }, children: stackOpen ? '×' : '+' + String(sessionBubbles.length - 1) })] }, "primary"));
                    }), sessionBubbles.length === 0 && (statusBubble !== undefined || whisper !== undefined) && (_jsxs("div", { className: clsx(styles.bubble, styles.bubbleStatus, whisper !== undefined && styles.bubbleWhisper), role: "status", "aria-live": "polite", children: [whisper === undefined && decoration !== undefined && (_jsx(StatusOrnament, { decoration: decoration, phase: phase })), whisper ?? statusBubble] }, whisper === undefined ? 'status' : 'whisper:' + whisper))] })), hovered && dragRef.current === null && (_jsx("div", { ref: panelRef, className: clsx(styles.panel, panelAbove && styles.panelAbove), "data-placement": panelAbove ? 'above' : 'below', style: panelAbove && panelLift > 0
                    ? { marginBottom: panelLift }
                    : undefined, onPointerEnter: () => {
                    // Reaching the panel (or its bridge) must cancel any hide timer
                    // the container's pointerleave may have armed while the pointer
                    // crossed the sliver between the sprite and the panel.
                    clearHideTimer();
                }, children: renaming ? (_jsxs("div", { className: styles.renameRow, children: [_jsx("input", { className: styles.nameInput, value: nameDraft, maxLength: 20, placeholder: props.t('pet.namePlaceholder'), autoFocus: true, onChange: (e) => setNameDraft(e.target.value), onCompositionStart: () => { composingRef.current = true; }, onCompositionEnd: () => { composingRef.current = false; }, onKeyDown: (e) => {
                                // While an IME composition is active (e.g. selecting a
                                // Chinese candidate), Enter/Escape keydowns belong to the
                                // input method: ignore them so candidate selection can
                                // neither submit the draft nor close the rename box. The
                                // explicit ref and the 'Process' key cover IMEs that mark
                                // composition keydowns with isComposing === false (#303).
                                if (composingRef.current || e.nativeEvent.isComposing || e.key === 'Process')
                                    return;
                                if (e.key === 'Enter') {
                                    const trimmed = nameDraft.trim();
                                    if (trimmed !== '') {
                                        props.onRename(trimmed);
                                        setRenaming(false);
                                    }
                                }
                                else if (e.key === 'Escape') {
                                    setRenaming(false);
                                }
                            } }), _jsx("button", { type: "button", className: styles.action, onClick: () => {
                                const trimmed = nameDraft.trim();
                                if (trimmed !== '') {
                                    props.onRename(trimmed);
                                    setRenaming(false);
                                }
                            }, children: panelLabel('confirm', props.t('pet.confirm')) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.rankRow, children: [_jsx("span", { className: styles.nameCell, children: displayName }), _jsx("span", { className: styles.statRank, children: panelStat('rank', 'pet.rank', { rank: snapshot?.affinity.rank ?? '?' }) })] }), _jsxs("div", { className: styles.rankRow, children: [_jsx("span", { className: styles.statTreats, children: panelStat('treats', 'pet.treats', { n: snapshot?.treats.stocked ?? 0 }) }), _jsx("span", { className: styles.statPoints, children: panelStat('points', 'pet.points', { points: snapshot?.affinity.points ?? 0 }) })] }), _jsxs("div", { className: styles.actions, children: [panelShows('feed') && (_jsx("button", { type: "button", className: styles.action, onClick: props.onFeed, children: panelLabel('feed', props.t('pet.feed')) })), panelShows('rename') && (_jsx("button", { type: "button", className: styles.action, onClick: () => {
                                        // Cancel any pending hide so the rename box cannot
                                        // unmount right as the user starts typing (#303).
                                        clearHideTimer();
                                        setNameDraft(displayName);
                                        setRenaming(true);
                                    }, children: panelLabel('rename', props.t('pet.rename')) })), panelShows('hide') && (_jsx("button", { type: "button", className: styles.action, onClick: props.onHide, children: panelLabel('hide', props.t('pet.hide')) }))] })] })) }))] }));
    return createPortal(float, document.body);
}
