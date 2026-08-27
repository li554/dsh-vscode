window.__ModuleLoader__.load({
	id: "@linxin666/dsh-pet",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/pet-store.ts
		/**
		* Browser-side pet store: the pet state snapshot plus transient UI feedback
		* (reaction bubbles), written only through the store's audit actions. The
		* RPC polling and interactions live in the plugin apply body; components
		* only ever read snapshots.
		* @module @linxin666/dsh-pet/client/pet-store
		*/
		/** Create the pet store handle (apply world only; never module-level). */
		function createPetStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					snapshot: null,
					pets: [],
					state: "loading",
					error: null,
					feedback: null
				}),
				actions: {
					setSnapshot: (draft, snapshot) => {
						draft.snapshot = snapshot;
						draft.state = "ready";
						draft.error = null;
					},
					setPets: (draft, pets) => {
						draft.pets = pets;
					},
					setState: (draft, state, error) => {
						draft.state = state;
						draft.error = error;
					},
					setFeedback: (draft, feedback) => {
						draft.feedback = feedback;
					}
				}
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region src/state.ts
		/**
		* Map one activity phase onto the animation contract.
		* - thinking → `running` and tool → `running-right` (focused work).
		* - review → `review` while answer text is streaming.
		* - waiting → `waiting` (expectant pose, needs user input).
		* - done → `jumping` (celebration), then back to `idle` after the window.
		* - failed → `failed` briefly, then back to `idle`.
		* - idle → `idle` (calm breathing loop).
		*/
		function animationForPhase(phase) {
			switch (phase) {
				case "thinking": return "running";
				case "tool": return "running-right";
				case "review": return "review";
				case "waiting": return "waiting";
				case "done": return "jumping";
				case "failed": return "failed";
				case "idle": return "idle";
			}
		}
		/** The spritesheet row index for one animation track. */
		function rowOf(animation) {
			return {
				"idle": 0,
				"running-right": 1,
				"running-left": 2,
				"waving": 3,
				"jumping": 4,
				"failed": 5,
				"waiting": 6,
				"running": 7,
				"review": 8
			}[animation];
		}
		//#endregion
		//#region src/client/spritesheet.ts
		/**
		* Spritesheet geometry helpers — parameterized by the pet definition the
		* host serves over '/api/pet/pets', so the browser half renders any registry
		* entry without per-pet code. The per-track tables (frames, durations, loop,
		* fallback) also come from the registry; these helpers only place frames,
		* guard track lengths, and map the fixed 9-row animation contract.
		* @module @linxin666/dsh-pet/client/spritesheet
		*/
		/** Row index of one animation track (the fixed 9-row contract). */
		function rowOfTrack(animation) {
			return rowOf(animation);
		}
		/**
		* Background-position (px) of one frame cell within the scaled atlas.
		* The background image is scaled by `scale` (element size ÷ cell size), and
		* background-position offsets are applied in SCALED coordinates — using raw
		* atlas coordinates here would drift each frame by the scale factor and
		* render torn/overlapping frames.
		*/
		function framePosition(cell, row, col, scale = 1) {
			return {
				x: -col * cell.width * scale,
				y: -row * cell.height * scale
			};
		}
		/**
		* Trim a track to the actual frame count of its row (the manifest's per-row
		* counts are authoritative; this is a last-line guard against a definition
		* whose row count disagrees with its track table). A row with 0 detected
		* frames degrades to the first frame so the pet never renders blank.
		*/
		function trimTrack(track, frameCount) {
			const n = Math.max(1, Math.min(frameCount, track.frames.length, track.durations.length));
			return {
				frames: track.frames.slice(0, n),
				durations: track.durations.slice(0, n),
				loop: track.loop,
				...track.fallback === void 0 ? {} : { fallback: track.fallback }
			};
		}
		//#endregion
		//#region src/client/sequences.ts
		/** Resolve the active track and frame after elapsed milliseconds of a looping sequence. */
		function sequenceFrameAt(sequence, tracks, elapsedMs) {
			const itemDurations = sequence.map((animation) => tracks[animation].durations.reduce((sum, value) => sum + value, 0));
			const sequenceDuration = itemDurations.reduce((sum, value) => sum + value, 0);
			let offset = Math.max(0, elapsedMs) % sequenceDuration;
			let itemIndex = 0;
			while (itemIndex < sequence.length - 1 && offset >= itemDurations[itemIndex]) {
				offset -= itemDurations[itemIndex];
				itemIndex += 1;
			}
			const animation = sequence[itemIndex];
			const track = tracks[animation];
			let frameIndex = 0;
			while (frameIndex < track.frames.length - 1 && offset >= track.durations[frameIndex]) {
				offset -= track.durations[frameIndex];
				frameIndex += 1;
			}
			return {
				animation,
				frameIndex
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-pet/src/client/pet.module.css.mjs
		const css$2 = ".kz2Bea_float{pointer-events:auto;-webkit-user-select:none;user-select:none;will-change:transform;contain:layout style;flex-direction:column;align-items:center;display:flex;position:fixed}.kz2Bea_sprite{image-rendering:auto;touch-action:none;contain:paint}.kz2Bea_spriteWrap{flex:none;position:relative}.kz2Bea_closeButton{z-index:2;color:#f8fafc;cursor:pointer;touch-action:manipulation;background:#070b1ac7;border:1px solid #e2e8ffb8;border-radius:999px;width:24px;height:24px;padding:0;font:600 18px/20px sans-serif;transition:background .12s,box-shadow .12s;position:absolute;top:4px;right:4px}.kz2Bea_closeButton:hover{background:#2c3e7ef2}.kz2Bea_closeButton:focus-visible{outline:none;box-shadow:0 0 0 2px #7e98fff2}.kz2Bea_bubble{white-space:nowrap;color:#f4f7ff;pointer-events:none;border-radius:999px;margin-bottom:6px;padding:4px 10px;font-size:12px;line-height:1.4;animation:2.6s ease-out forwards kz2Bea_pet-bubble-pop;position:absolute;bottom:100%;box-shadow:0 2px 8px #00000040}.kz2Bea_bubblePet{background:#4d6bfef2}.kz2Bea_bubbleFeed{background:#0369a1f2}.kz2Bea_bubbleStatus{text-overflow:ellipsis;backdrop-filter:blur(8px);letter-spacing:.02em;background:linear-gradient(160deg,#131c36e6,#070b1af0);border:1px solid #7e98ff73;max-width:min(280px,100vw - 24px);padding:5px 12px;animation:.24s ease-out kz2Bea_pet-bubble-in;overflow:hidden;box-shadow:0 4px 12px #02061759,inset 0 1px #e2e8ff1a,0 0 12px #4d6bfe2e}.kz2Bea_bubbleWhisper{letter-spacing:.03em;animation:.32s cubic-bezier(.22,1,.36,1) kz2Bea_pet-whisper-in}.kz2Bea_bubbleWhisper:before{content:\"「\";opacity:.7;margin-right:2px}.kz2Bea_bubbleWhisper:after{content:\"」\";opacity:.7;margin-left:2px}.kz2Bea_bubbleStack{pointer-events:auto;flex-direction:column-reverse;align-items:center;gap:4px;display:flex;position:absolute;bottom:100%}.kz2Bea_bubbleAnchor{display:inline-flex;position:relative}.kz2Bea_bubbleMore{z-index:1;color:#eef2ff;cursor:pointer;background:linear-gradient(160deg,#4a68f5f2,#2f44b8f2);border:1px solid #7e98ff8c;border-radius:999px;justify-content:center;align-items:center;min-width:18px;height:18px;padding:0 5px;font-size:10px;font-weight:600;line-height:1;transition:filter .12s;display:inline-flex;position:absolute;top:-9px;right:-10px;box-shadow:0 2px 6px #02061766}.kz2Bea_bubbleMore:hover{filter:brightness(1.15)}.kz2Bea_bubbleMore:focus-visible{outline:none;box-shadow:0 0 0 2px #7e98ffe6}.kz2Bea_bubbleStack .kz2Bea_bubble{pointer-events:auto;margin-bottom:0;position:relative;bottom:auto}.kz2Bea_bubbleClickable{cursor:pointer;font:inherit;text-align:center;appearance:none;transition:filter .12s,box-shadow .12s}.kz2Bea_bubbleClickable:hover{filter:brightness(1.12)}.kz2Bea_bubbleClickable:focus-visible{outline:none;box-shadow:0 0 0 2px #7e98ffe6}@keyframes kz2Bea_pet-bubble-in{0%{opacity:0;transform:translateY(6px)scale(.96)}to{opacity:1;transform:translateY(0)scale(1)}}@keyframes kz2Bea_pet-whisper-in{0%{opacity:0;transform:translateY(8px)scale(.9)}60%{transform:translateY(-1px)scale(1.02)}to{opacity:1;transform:translateY(0)scale(1)}}@keyframes kz2Bea_pet-panel-in{0%{opacity:0;transform:translateY(4px)scale(.97)}to{opacity:1;transform:translateY(0)scale(1)}}@keyframes kz2Bea_pet-bubble-pop{0%{opacity:0;transform:translateY(6px)scale(.85)}15%{opacity:1;transform:translateY(0)scale(1.05)}25%{transform:translateY(0)scale(1)}75%{opacity:1}to{opacity:0;transform:translateY(-8px)scale(.95)}}.kz2Bea_panel{color:#e6ebf8;backdrop-filter:blur(10px);transform-origin:50% 0;background:linear-gradient(165deg,#131c36f2,#070b1af7);border:1px solid #7e98ff4d;border-radius:12px;flex-direction:column;gap:7px;min-width:148px;margin-top:8px;padding:10px 12px;font-size:12px;animation:.2s cubic-bezier(.22,1,.36,1) kz2Bea_pet-panel-in;display:flex;position:absolute;top:100%;box-shadow:0 8px 24px #02061773,0 0 0 1px #4d6bfe1a,inset 0 1px #e2e8ff14}.kz2Bea_panel:after{content:\"\";height:14px;position:absolute;bottom:100%;left:0;right:0}.kz2Bea_panelAbove{transform-origin:50% 100%;margin-top:0;margin-bottom:8px;top:auto;bottom:100%}.kz2Bea_panelAbove:after{top:100%;bottom:auto}.kz2Bea_rankRow{white-space:nowrap;justify-content:space-between;gap:10px;display:flex}.kz2Bea_nameCell{letter-spacing:.02em;background:linear-gradient(90deg,#a9c1ff,#6c8bff 60%,#4d6bfe);color:#0000;-webkit-background-clip:text;background-clip:text;font-weight:600}.kz2Bea_statRank{color:#9db4ff;font-weight:600}.kz2Bea_statTreats{color:#7dd3fc;font-weight:600}.kz2Bea_statPoints{color:#fcd34d;font-weight:600}.kz2Bea_renameRow{align-items:center;gap:6px;display:flex}.kz2Bea_nameInput{color:#e6ebf8;background:#131c36e6;border:1px solid #7e98ff80;border-radius:6px;outline:none;flex:1;min-width:0;padding:3px 6px;font-size:12px}.kz2Bea_nameInput:focus{border-color:#4d6bfe;box-shadow:0 0 0 2px #4d6bfe73}.kz2Bea_actions{gap:6px;display:flex}.kz2Bea_action{cursor:pointer;color:#fff;background:linear-gradient(#4a68f5,#3a55e0);border:none;border-radius:6px;flex:1;padding:4px 8px;font-size:12px;font-weight:600;transition:filter .12s,box-shadow .12s,transform .12s;box-shadow:0 2px 6px #4d6bfe4d}.kz2Bea_action:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 4px 10px #4d6bfe66}.kz2Bea_action:active{filter:brightness(.94);transform:translateY(0);box-shadow:0 1px 4px #4d6bfe4d}.kz2Bea_action:focus-visible{outline:none;box-shadow:0 0 0 2px #7e98ffe6}.kz2Bea_summon{color:#8ea6ff;cursor:pointer;background:#070b1abf;border:1px dashed #7e98ff99;border-radius:999px;padding:2px 10px;font-size:11px;transition:border-color .12s,color .12s,background .12s,box-shadow .12s}.kz2Bea_summon:hover{color:#c3d3ff;background:#070b1ae6;border-color:#7e98fff2}.kz2Bea_summon:active{color:#8ea6ff;border-color:#7e98ffcc}.kz2Bea_summon:focus-visible{outline:none;box-shadow:0 0 0 2px #7e98ffe6}@media (prefers-reduced-motion:reduce){.kz2Bea_bubble,.kz2Bea_bubbleStatus,.kz2Bea_bubbleWhisper,.kz2Bea_panel{opacity:1;animation:none}.kz2Bea_action,.kz2Bea_summon,.kz2Bea_bubbleMore,.kz2Bea_closeButton{transition:none}}";
		const tagId$2 = "@linxin666/dsh-pet/pet.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-pet";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var pet_module_css_default = {
			"action": "kz2Bea_action",
			"actions": "kz2Bea_actions",
			"bubble": "kz2Bea_bubble",
			"bubbleAnchor": "kz2Bea_bubbleAnchor",
			"bubbleClickable": "kz2Bea_bubbleClickable",
			"bubbleFeed": "kz2Bea_bubbleFeed",
			"bubbleMore": "kz2Bea_bubbleMore",
			"bubblePet": "kz2Bea_bubblePet",
			"bubbleStack": "kz2Bea_bubbleStack",
			"bubbleStatus": "kz2Bea_bubbleStatus",
			"bubbleWhisper": "kz2Bea_bubbleWhisper",
			"closeButton": "kz2Bea_closeButton",
			"float": "kz2Bea_float",
			"nameCell": "kz2Bea_nameCell",
			"nameInput": "kz2Bea_nameInput",
			"panel": "kz2Bea_panel",
			"panelAbove": "kz2Bea_panelAbove",
			"pet-bubble-in": "kz2Bea_pet-bubble-in",
			"pet-bubble-pop": "kz2Bea_pet-bubble-pop",
			"pet-panel-in": "kz2Bea_pet-panel-in",
			"pet-whisper-in": "kz2Bea_pet-whisper-in",
			"rankRow": "kz2Bea_rankRow",
			"renameRow": "kz2Bea_renameRow",
			"sprite": "kz2Bea_sprite",
			"spriteWrap": "kz2Bea_spriteWrap",
			"statPoints": "kz2Bea_statPoints",
			"statRank": "kz2Bea_statRank",
			"statTreats": "kz2Bea_statTreats",
			"summon": "kz2Bea_summon"
		};
		//#endregion
		//#region src/client/PetSprite.tsx
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
			const shown = segment !== void 0 && segment !== "hide";
			const segmentKey = segment !== void 0 && segment !== "hide" ? segment.from + ":" + segment.to : "none";
			const spanRef = (0, react.useRef)(null);
			const scale = 18 / decoration.cell.height;
			const frameWidth = Math.round(decoration.cell.width * scale);
			const stripWidth = decoration.columns * frameWidth;
			const durationsKey = decoration.durations.join(",");
			(0, react.useEffect)(() => {
				if (segment === void 0 || segment === "hide") return;
				const el = spanRef.current;
				if (el === null) return;
				const position = (index) => -index * frameWidth + "px 0px";
				const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
				el.style.backgroundPosition = position(segment.from);
				if (reduceMotion || segment.from === segment.to) return;
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
					if (elapsed >= duration) {
						do {
							elapsed -= duration;
							if (index < segment.to) index += 1;
							else if (decoration.loop) index = segment.from;
						} while (elapsed >= duration);
						el.style.backgroundPosition = position(index);
					}
					if (!decoration.loop && index === segment.to) return;
					timer = window.setTimeout(tick, Math.max(1, duration - elapsed));
				};
				timer = window.setTimeout(tick, 0);
				return () => window.clearTimeout(timer);
			}, [
				shown,
				segmentKey,
				frameWidth,
				decoration.loop,
				durationsKey
			]);
			if (!shown) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: spanRef,
				"aria-hidden": "true",
				"data-dsh-pet-decoration": decoration.id,
				style: {
					display: "inline-block",
					width: frameWidth,
					height: 18,
					marginRight: 6,
					verticalAlign: "middle",
					flexShrink: 0,
					backgroundImage: "url(" + decoration.entryUrl + ")",
					backgroundSize: stripWidth + "px 18px",
					backgroundRepeat: "no-repeat",
					backgroundPosition: "0px 0px"
				}
			});
		}
		/**
		* The floating pet. The spritesheet frame advances on requestAnimationFrame
		* with per-frame durations from the definition's tracks; the atlas image is
		* loaded once and the background position is written straight to the sprite
		* element (no per-frame React state).
		*/
		function PetSprite(props) {
			const { snapshot, definition, display, feedback } = props;
			const spriteRef = (0, react.useRef)(null);
			const floatRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const bubbleRef = (0, react.useRef)(null);
			const [imageReady, setImageReady] = (0, react.useState)(false);
			const [hovered, setHovered] = (0, react.useState)(false);
			const [stackPeek, setStackPeek] = (0, react.useState)(false);
			const [stackPinned, setStackPinned] = (0, react.useState)(false);
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [panelAbove, setPanelAbove] = (0, react.useState)(false);
			const [panelLift, setPanelLift] = (0, react.useState)(0);
			const [nameDraft, setNameDraft] = (0, react.useState)("");
			const composingRef = (0, react.useRef)(false);
			const [dragPos, setDragPos] = (0, react.useState)(null);
			const dragRef = (0, react.useRef)(null);
			const hideTimerRef = (0, react.useRef)(null);
			const frameRef = (0, react.useRef)({
				track: null,
				index: 0,
				elapsed: 0
			});
			const cell = definition.cell;
			const columns = definition.columns;
			const rows = definition.rows;
			const tracks = definition.tracks;
			const sequences = definition.sequences;
			const panel = definition.panel;
			const panelLabel = (slot, i18n) => panel?.labels?.[slot] ?? i18n;
			const panelStat = (slot, i18nKey, values) => {
				const format = panel?.stats?.[slot] ?? props.t(i18nKey, values);
				if (panel?.stats?.[slot] === void 0) return format;
				const all = {
					rank: snapshot?.affinity.rank ?? "?",
					n: snapshot?.treats.stocked ?? 0,
					points: snapshot?.affinity.points ?? 0
				};
				let text = format;
				for (const [name, value] of Object.entries(all)) text = text.replaceAll("{" + name + "}", String(value));
				return text;
			};
			const panelShows = (action) => panel?.actions === void 0 || panel.actions.includes(action);
			(0, react.useEffect)(() => {
				if (props.visual !== void 0) return;
				let cancelled = false;
				const img = new Image();
				img.onload = () => {
					if (!cancelled) setImageReady(true);
				};
				img.src = definition.atlasUrl;
				return () => {
					cancelled = true;
					img.onload = null;
				};
			}, [definition.atlasUrl, props.visual]);
			const spriteScale = display.size / cell.height;
			const phase = snapshot?.phase ?? "idle";
			const animation = snapshot?.animation ?? "idle";
			const scaleRef = (0, react.useRef)(spriteScale);
			scaleRef.current = spriteScale;
			(0, react.useEffect)(() => {
				if (props.visual !== void 0) return;
				const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
				const sequence = animation === animationForPhase(phase) ? sequences?.[phase] : void 0;
				const leadAnimation = sequence?.[0] ?? animation;
				const row = rowOfTrack(leadAnimation);
				const track = trimTrack(tracks[leadAnimation], rows[row] ?? tracks[leadAnimation].frames.length);
				const leadCol = track.frames[0];
				const lead = framePosition(cell, row, leadCol, scaleRef.current);
				let lastPosStr = lead.x + "px " + lead.y + "px";
				if (spriteRef.current !== null) spriteRef.current.style.backgroundPosition = lastPosStr;
				if (reduceMotion) return;
				let raf = 0;
				let last = performance.now();
				let sequenceElapsed = 0;
				const tick = (ts) => {
					const delta = ts - last;
					last = ts;
					if (sequence !== void 0) {
						sequenceElapsed += delta;
						const current = sequenceFrameAt(sequence, tracks, sequenceElapsed);
						const currentRow = rowOfTrack(current.animation);
						const col = trimTrack(tracks[current.animation], rows[currentRow] ?? tracks[current.animation].frames.length).frames[current.frameIndex];
						const pos = framePosition(cell, currentRow, col, scaleRef.current);
						const posStr = pos.x + "px " + pos.y + "px";
						if (posStr !== lastPosStr) {
							lastPosStr = posStr;
							if (spriteRef.current !== null) spriteRef.current.style.backgroundPosition = posStr;
						}
						raf = requestAnimationFrame(tick);
						return;
					}
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
					if (st.elapsed >= (track.durations[st.index] ?? 0)) if (track.loop) {
						st.elapsed = 0;
						st.index = 0;
					} else st.index = maxIndex;
					const col = track.frames[st.index];
					const pos = framePosition(cell, row, col, scaleRef.current);
					const posStr = pos.x + "px " + pos.y + "px";
					if (posStr !== lastPosStr) {
						lastPosStr = posStr;
						if (spriteRef.current !== null) spriteRef.current.style.backgroundPosition = posStr;
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
				return () => cancelAnimationFrame(raf);
			}, [
				animation,
				phase,
				cell,
				columns,
				rows,
				tracks,
				sequences,
				props.visual
			]);
			const feedbackDoneRef = (0, react.useRef)(props.onFeedbackDone);
			feedbackDoneRef.current = props.onFeedbackDone;
			(0, react.useEffect)(() => {
				if (feedback === null) return;
				const timer = window.setTimeout(() => feedbackDoneRef.current(), 2600);
				return () => window.clearTimeout(timer);
			}, [feedback]);
			const draggedRef = (0, react.useRef)(false);
			const clearHideTimer = () => {
				if (hideTimerRef.current !== null) {
					window.clearTimeout(hideTimerRef.current);
					hideTimerRef.current = null;
				}
			};
			(0, react.useEffect)(() => () => clearHideTimer(), []);
			const onPointerDown = (e) => {
				e.preventDefault();
				e.target.setPointerCapture?.(e.pointerId);
				const current = dragPos ?? {
					right: display.right,
					bottom: display.bottom
				};
				dragRef.current = {
					startX: e.clientX,
					startY: e.clientY,
					...current
				};
				draggedRef.current = false;
				setHovered(false);
			};
			const onPointerMove = (e) => {
				const drag = dragRef.current;
				if (drag === null) return;
				const dx = e.clientX - drag.startX;
				const dy = e.clientY - drag.startY;
				if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
				const right = clampOffset(drag.right - dx, window.innerWidth - 40);
				const bottom = clampOffset(drag.bottom - dy, window.innerHeight - 40);
				setDragPos({
					right,
					bottom
				});
			};
			const onPointerUp = () => {
				if (dragRef.current === null) return;
				dragRef.current = null;
				if (dragPos !== null) props.onDragEnd(dragPos.right, dragPos.bottom);
			};
			const pos = dragPos ?? {
				right: display.right,
				bottom: display.bottom
			};
			const spriteWidth = Math.round(cell.width * spriteScale);
			const spriteHeight = Math.round(cell.height * spriteScale);
			const sessionBubbles = snapshot?.sessions ?? [];
			const stackOpen = stackPeek || stackPinned;
			const visibleSessions = !stackOpen && sessionBubbles.length > 1 ? sessionBubbles.slice(0, 1) : sessionBubbles;
			const statusBubble = feedback === null && sessionBubbles.length === 0 ? snapshot?.bubble : void 0;
			const whisper = feedback === null ? snapshot?.whisper : void 0;
			const bubblePresent = feedback !== null || sessionBubbles.length > 0 || statusBubble !== void 0 || whisper !== void 0;
			const displayName = snapshot?.name ?? definition.displayName;
			const decoration = snapshot?.decoration;
			(0, react.useEffect)(() => {
				if (sessionBubbles.length <= 1) setStackPinned(false);
			}, [sessionBubbles.length]);
			(0, react.useLayoutEffect)(() => {
				if (!hovered) {
					setPanelAbove(false);
					setPanelLift(0);
					return;
				}
				const updatePanelPlacement = () => {
					const sprite = spriteRef.current;
					const panel = panelRef.current;
					if (sprite === null || panel === null) return;
					const above = window.innerHeight - sprite.getBoundingClientRect().bottom < panel.getBoundingClientRect().height + 8;
					setPanelAbove(above);
					const bubbleHeight = above ? bubbleRef.current?.getBoundingClientRect().height ?? 0 : 0;
					setPanelLift(bubbleHeight > 0 ? Math.ceil(bubbleHeight) + 14 : 0);
				};
				updatePanelPlacement();
				window.addEventListener("resize", updatePanelPlacement);
				return () => window.removeEventListener("resize", updatePanelPlacement);
			}, [
				hovered,
				renaming,
				pos.right,
				pos.bottom,
				display.size,
				bubblePresent,
				sessionBubbles.length,
				stackOpen,
				feedback
			]);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: floatRef,
				className: pet_module_css_default.float,
				style: {
					right: pos.right,
					bottom: pos.bottom,
					zIndex: 2147483e3
				},
				onPointerEnter: () => {
					clearHideTimer();
					setHovered(true);
				},
				onPointerLeave: (e) => {
					const next = e.relatedTarget;
					if (next instanceof Node && floatRef.current?.contains(next)) return;
					if (renaming) return;
					clearHideTimer();
					hideTimerRef.current = window.setTimeout(() => setHovered(false), 300);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: pet_module_css_default.spriteWrap,
						style: {
							width: spriteWidth,
							height: spriteHeight
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							ref: spriteRef,
							className: pet_module_css_default.sprite,
							style: {
								width: spriteWidth,
								height: spriteHeight,
								...props.visual === void 0 ? {
									backgroundImage: imageReady ? "url(" + definition.atlasUrl + ")" : void 0,
									backgroundSize: cell.width * columns * spriteScale + "px " + cell.height * (definition.atlasRows ?? rows.length) * spriteScale + "px",
									backgroundRepeat: "no-repeat",
									backgroundPosition: "0 0"
								} : {},
								cursor: dragRef.current === null ? "grab" : "grabbing"
							},
							onPointerDown,
							onPointerMove,
							onPointerUp,
							onClick: () => {
								if (draggedRef.current) return;
								props.onPet();
							},
							role: "button",
							"aria-label": definition.displayName,
							children: props.visual
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: pet_module_css_default.closeButton,
							"aria-label": panelLabel("hide", props.t("pet.hide")),
							title: panelLabel("hide", props.t("pet.hide")),
							"data-testid": "pet-close",
							onPointerDown: (e) => {
								e.stopPropagation();
							},
							onClick: (e) => {
								e.stopPropagation();
								props.onHide();
							},
							children: "×"
						})]
					}),
					feedback !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: bubbleRef,
						className: clsx(pet_module_css_default.bubble, feedback.kind === "feed" ? pet_module_css_default.bubbleFeed : pet_module_css_default.bubblePet),
						children: feedback.text
					}, feedback.at),
					feedback === null && (sessionBubbles.length > 0 || statusBubble !== void 0 || whisper !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: bubbleRef,
						className: pet_module_css_default.bubbleStack,
						onPointerEnter: () => setStackPeek(true),
						onPointerLeave: () => setStackPeek(false),
						children: [visibleSessions.map((session, index) => {
							const speaksWhisper = index === 0 && whisper !== void 0;
							const bubble = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(pet_module_css_default.bubble, pet_module_css_default.bubbleStatus, pet_module_css_default.bubbleClickable, speaksWhisper && pet_module_css_default.bubbleWhisper),
								title: props.t("pet.openSessionHint"),
								onClick: () => {
									props.onOpenSession(session.sessionId);
								},
								children: [index === 0 && !speaksWhisper && decoration !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusOrnament, {
									decoration,
									phase
								}), speaksWhisper ? whisper : session.bubble]
							}, speaksWhisper ? "whisper:" + whisper : session.sessionId);
							if (index !== 0 || sessionBubbles.length <= 1) return bubble;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: pet_module_css_default.bubbleAnchor,
								children: [bubble, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: pet_module_css_default.bubbleMore,
									title: stackOpen ? props.t("pet.collapseSessions") : props.t("pet.moreSessions", { n: sessionBubbles.length - 1 }),
									"aria-label": stackOpen ? props.t("pet.collapseSessions") : props.t("pet.moreSessions", { n: sessionBubbles.length - 1 }),
									"aria-expanded": stackOpen,
									onClick: (e) => {
										e.stopPropagation();
										setStackPinned((open) => !open);
									},
									children: stackOpen ? "×" : "+" + String(sessionBubbles.length - 1)
								})]
							}, "primary");
						}), sessionBubbles.length === 0 && (statusBubble !== void 0 || whisper !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: clsx(pet_module_css_default.bubble, pet_module_css_default.bubbleStatus, whisper !== void 0 && pet_module_css_default.bubbleWhisper),
							role: "status",
							"aria-live": "polite",
							children: [whisper === void 0 && decoration !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusOrnament, {
								decoration,
								phase
							}), whisper ?? statusBubble]
						}, whisper === void 0 ? "status" : "whisper:" + whisper)]
					}),
					hovered && dragRef.current === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: panelRef,
						className: clsx(pet_module_css_default.panel, panelAbove && pet_module_css_default.panelAbove),
						"data-placement": panelAbove ? "above" : "below",
						style: panelAbove && panelLift > 0 ? { marginBottom: panelLift } : void 0,
						onPointerEnter: () => {
							clearHideTimer();
						},
						children: renaming ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: pet_module_css_default.renameRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: pet_module_css_default.nameInput,
								value: nameDraft,
								maxLength: 20,
								placeholder: props.t("pet.namePlaceholder"),
								autoFocus: true,
								onChange: (e) => setNameDraft(e.target.value),
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								},
								onKeyDown: (e) => {
									if (composingRef.current || e.nativeEvent.isComposing || e.key === "Process") return;
									if (e.key === "Enter") {
										const trimmed = nameDraft.trim();
										if (trimmed !== "") {
											props.onRename(trimmed);
											setRenaming(false);
										}
									} else if (e.key === "Escape") setRenaming(false);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: pet_module_css_default.action,
								onClick: () => {
									const trimmed = nameDraft.trim();
									if (trimmed !== "") {
										props.onRename(trimmed);
										setRenaming(false);
									}
								},
								children: panelLabel("confirm", props.t("pet.confirm"))
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: pet_module_css_default.rankRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: pet_module_css_default.nameCell,
									children: displayName
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: pet_module_css_default.statRank,
									children: panelStat("rank", "pet.rank", { rank: snapshot?.affinity.rank ?? "?" })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: pet_module_css_default.rankRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: pet_module_css_default.statTreats,
									children: panelStat("treats", "pet.treats", { n: snapshot?.treats.stocked ?? 0 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: pet_module_css_default.statPoints,
									children: panelStat("points", "pet.points", { points: snapshot?.affinity.points ?? 0 })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: pet_module_css_default.actions,
								children: [
									panelShows("feed") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: pet_module_css_default.action,
										onClick: props.onFeed,
										children: panelLabel("feed", props.t("pet.feed"))
									}),
									panelShows("rename") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: pet_module_css_default.action,
										onClick: () => {
											clearHideTimer();
											setNameDraft(displayName);
											setRenaming(true);
										},
										children: panelLabel("rename", props.t("pet.rename"))
									}),
									panelShows("hide") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: pet_module_css_default.action,
										onClick: props.onHide,
										children: panelLabel("hide", props.t("pet.hide"))
									})
								]
							})
						] })
					})
				]
			}), document.body);
		}
		//#endregion
		//#region src/client/renderers/registry.ts
		/** Renderer dispatch table. */
		var RendererRegistry = class {
			renderers = /* @__PURE__ */ new Map();
			/** Register one renderer implementation (id wins on re-register). */
			register(renderer) {
				this.renderers.set(renderer.id, renderer);
			}
			/** Whether a renderer kind is available in this build. */
			has(id) {
				return this.renderers.has(id);
			}
			/** The registered renderer kinds (for diagnostics). */
			kinds() {
				return [...this.renderers.keys()].sort();
			}
			/** Remove every registration (tests; the client index registers once). */
			clear() {
				this.renderers.clear();
			}
			/**
			* Mount a renderer for one activation. An unknown kind renders a clear
			* diagnostic card into the container instead of failing silently.
			*/
			mount(kind, ctx, config) {
				const renderer = this.renderers.get(kind);
				if (renderer === void 0) {
					const note = document.createElement("div");
					note.dataset.dshPetRendererFallback = kind;
					note.textContent = "Pet renderer \"" + kind + "\" is not available in this build (supported: " + this.kinds().join(", ") + ").";
					ctx.container.appendChild(note);
					ctx.onCleanup(() => note.remove());
					return { dispose: () => note.remove() };
				}
				return renderer.mount(ctx, renderer.validateConfig(config));
			}
		};
		/**
		* The plugin-wide renderer registry. The client entry registers the
		* built-in renderers at apply time; the renderer switch and the live2d
		* bridge dispatch through this instance.
		*/
		const defaultPetRendererRegistry = new RendererRegistry();
		//#endregion
		//#region src/client/phase-stream.ts
		/** Create the stream (one per pet entry lifetime, owned by the plugin body). */
		function createPhaseStream(initial = "idle") {
			let current = initial;
			const listeners = /* @__PURE__ */ new Set();
			return {
				get: () => current,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				push(phase) {
					if (phase === current) return;
					current = phase;
					for (const listener of [...listeners]) listener(phase);
				}
			};
		}
		//#endregion
		//#region src/client/renderers/live2d/Live2dVisualMount.tsx
		/**
		* Live2D visual mount (pet-center M3) — the React bridge between the pet
		* center chrome and the imperative live2d renderer. The bridge owns the
		* contract context (asset base, phase stream, interaction write-back,
		* activation cleanups), feeds the polled phase into the stream, forwards
		* sub-4px taps as hit-test coordinates, and renders the localized error
		* card when the renderer reports a fatal boot failure.
		* @module @linxin666/dsh-pet/client/renderers/live2d/Live2dVisualMount
		*/
		/** Mount the live2d renderer as the sprite's visual (inside the chrome). */
		function Live2dVisualMount(props) {
			const containerRef = (0, react.useRef)(null);
			const streamRef = (0, react.useRef)(null);
			const handleRef = (0, react.useRef)(null);
			const downRef = (0, react.useRef)(null);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setError(null);
				const container = containerRef.current;
				const live2d = props.definition.live2d;
				if (container === null || live2d === void 0) return void 0;
				streamRef.current ??= createPhaseStream(props.phase);
				const cleanups = [];
				const ctx = {
					petId: props.definition.id,
					assetBase: "/pet/" + encodeURIComponent(props.definition.id),
					container,
					phase: streamRef.current,
					interact: props.onPet,
					onCleanup: (fn) => {
						cleanups.push(fn);
					}
				};
				let handle;
				try {
					handle = defaultPetRendererRegistry.mount("live2d", ctx, live2d);
				} catch {
					setError("load-failed");
					return () => {
						for (const fn of cleanups.splice(0)) fn();
					};
				}
				handleRef.current = handle;
				handle.onError?.(setError);
				return () => {
					handleRef.current = null;
					for (const fn of cleanups.splice(0)) fn();
					handle.dispose();
				};
			}, [props.definition]);
			(0, react.useEffect)(() => {
				streamRef.current?.push(props.phase);
			}, [props.phase]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: containerRef,
				"data-dsh-pet-live2d": props.definition.id,
				style: {
					width: "100%",
					height: "100%"
				},
				onPointerDown: (e) => {
					downRef.current = {
						x: e.clientX,
						y: e.clientY
					};
				},
				onPointerUp: (e) => {
					const down = downRef.current;
					downRef.current = null;
					if (down === null) return;
					if (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4) return;
					const rect = e.currentTarget.getBoundingClientRect();
					handleRef.current?.tap(e.clientX - rect.left, e.clientY - rect.top);
				},
				children: error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"data-dsh-pet-live2d-error": error,
					children: error === "core-missing" ? props.t("pet.live2d.core-missing") : error === "vendor-missing" ? props.t("pet.live2d.vendor-missing") : props.t("pet.live2d.load-failed")
				})
			});
		}
		//#endregion
		//#region src/client/renderers/PetRendererSwitch.tsx
		/**
		* Renderer switch — the client dispatch seam of the pet center (issue #623,
		* milestone M2 P5 / M3). The pet's manifest picks the renderer: sprite2d
		* hands straight through to the sprite; live2d injects its visual INTO the
		* sprite chrome (the dock, bubbles and panel belong to the pet center, not
		* the renderer); a renderer this build cannot serve renders a clear
		* diagnostic card instead of blanking.
		* @module @linxin666/dsh-pet/client/renderers/PetRendererSwitch
		*/
		/** Dispatch one pet definition to its renderer; unknown kinds get a card. */
		function PetRendererSwitch(props) {
			const renderer = props.definition.renderer ?? "sprite2d";
			if (renderer === "sprite2d") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: props.children });
			if (renderer === "live2d" && defaultPetRendererRegistry.has("live2d") && (0, react.isValidElement)(props.children)) {
				const visual = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Live2dVisualMount, {
					definition: props.definition,
					phase: props.phase,
					onPet: props.onPet,
					t: props.t
				});
				return (0, react.cloneElement)(props.children, { visual });
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-dsh-pet-renderer-fallback": renderer,
				children: props.t("pet.renderer.unavailable", { renderer })
			});
		}
		//#endregion
		//#region src/client/PetDockEntry.tsx
		/**
		* Global floating pet entry. The pet is host-global (its state, display and
		* interactions live on '/api/pet/*' endpoints with no session dimension), so
		* it must not ride a session-scoped slot — on the new-conversation screen no
		* session exists to scope a slot by, and the pet would vanish (issue #48).
		* The client half therefore mounts this entry straight onto 'document.body'
		* (see index.ts): while visible it renders the floating PetSprite (a
		* portal), while hidden it renders a fixed-position summon button. Which
		* sprite renders is decided by the host snapshot's pet id resolved against
		* the registry list — no per-pet component exists.
		* @module @linxin666/dsh-pet/client/PetDockEntry
		*/
		const DEFAULT_DISPLAY = {
			visible: true,
			size: 160,
			right: 24,
			bottom: 20
		};
		/**
		* Dock entry: while the pet is visible, mount the floating PetSprite (it
		* portals itself onto document.body); while hidden, render the summon
		* button so the pet can always come back. The store is the plugin-owned
		* single instance — the slot system provides none because the pet is
		* host-global, not session-scoped.
		*/
		function PetDockEntry(props) {
			const { store, ensure } = props;
			const ui = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
			const snapshot = ui.snapshot;
			const feedback = ui.feedback;
			const definition = ui.pets.find((entry) => entry.id === snapshot?.pet.id) ?? null;
			const visible = snapshot?.display.visible ?? true;
			(0, react.useEffect)(() => {
				ensure();
			}, [ensure]);
			if (visible) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-pet-dock": true,
				"data-testid": "pet-dock",
				children: snapshot === null || definition === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetRendererSwitch, {
					definition,
					phase: snapshot?.phase ?? "idle",
					onPet: props.pet,
					t: props.t,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetSprite, {
						snapshot,
						definition,
						display: snapshot.display,
						feedback,
						onPet: props.pet,
						onFeed: props.feed,
						onHide: props.hide,
						onDragEnd: props.dragEnd,
						onRename: props.rename,
						onOpenSession: props.openSession,
						onFeedbackDone: props.feedbackDone,
						t: props.t
					})
				})
			});
			const display = snapshot?.display ?? DEFAULT_DISPLAY;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: pet_module_css_default.summon,
				style: {
					position: "fixed",
					right: display.right,
					bottom: display.bottom,
					zIndex: 2147483e3
				},
				onClick: props.summon,
				"data-testid": "pet-summon",
				"data-dsh-part": "summon-button",
				children: props.t("pet.summon", { name: snapshot?.name ?? "" })
			});
		}
		//#endregion
		//#region src/contracts/renderer.ts
		/** Contract version renderers declare against (independent of the manifest). */
		const PET_RENDERER_API_VERSION = "x-org.linxin666.pet-center/v1alpha1";
		//#endregion
		//#region src/client/renderers/live2d/runtime.ts
		/**
		* Live2D runtime loading (pet-center M3) — the two scripts a live2d mount
		* needs, fetched lazily through the plugin's own runtime route: the
		* user-supplied Cubism Core (proprietary; the plugin never bundles or
		* downloads it — issue #623 M1 §0) and the plugin-shipped MIT vendor bundle
		* (pixi.js + untitled-pixi-live2d-engine). Each loads at most once per page;
		* concurrent mounts share the in-flight promise, and a failure is cached as
		* 'absent' so a broken install stops retrying the network every mount.
		*
		* The vendor surface below is the structural slice the renderer consumes;
		* the real objects come from 'window.__dshPetLive2d' (lib/live2d-vendor.js),
		* so this module never imports pixi — the client bundle stays lean.
		* @module @linxin666/dsh-pet/client/renderers/live2d/runtime
		*/
		/** Runtime file URLs the host serves ('/api/pet/runtime/<name>', M3-2). */
		const CORE_URL = "/api/pet/runtime/live2dcubismcore.min.js";
		const VENDOR_URL = "/api/pet/runtime/live2d-vendor.js";
		const defaultInjector = (src) => new Promise((resolve, reject) => {
			const tag = document.createElement("script");
			tag.src = src;
			tag.onload = () => resolve();
			tag.onerror = () => reject(/* @__PURE__ */ new Error("script failed to load: " + src));
			document.head.appendChild(tag);
		});
		let corePromise;
		let vendorPromise;
		/**
		* Ensure the Cubism Core global exists, injecting the runtime-route script
		* once when absent. Resolves false when the user has not installed the core
		* (a normal state — the renderer turns it into install guidance).
		*/
		function ensureCubismCore(probe = {}) {
			if (typeof window !== "undefined" && window.Live2DCubismCore !== void 0) return Promise.resolve(true);
			if (probe.inject !== void 0) return probe.inject(CORE_URL).then(() => typeof window !== "undefined" && window.Live2DCubismCore !== void 0).catch(() => false);
			corePromise ??= defaultInjector(CORE_URL).then(() => typeof window !== "undefined" && window.Live2DCubismCore !== void 0).catch(() => false);
			return corePromise;
		}
		/** Ensure the plugin vendor bundle global exists (same caching discipline). */
		function ensureLive2dVendor(probe = {}) {
			if (typeof window !== "undefined" && window.__dshPetLive2d !== void 0) return Promise.resolve(window.__dshPetLive2d);
			if (probe.inject !== void 0) return probe.inject(VENDOR_URL).then(() => typeof window !== "undefined" ? window.__dshPetLive2d : void 0).catch(() => void 0);
			vendorPromise ??= defaultInjector(VENDOR_URL).then(() => typeof window !== "undefined" ? window.__dshPetLive2d : void 0).catch(() => void 0);
			return vendorPromise;
		}
		//#endregion
		//#region src/client/renderers/live2d.ts
		/** The de-facto tap-motion group of Cubism sample models. */
		const TAP_GROUP = "TapBody";
		/**
		* Keep one screen-appropriate atlas LOD instead of asking Pixi for the
		* engine's default full mip chain. A user model can legitimately carry an
		* 8192px texture while the pet itself is only a few hundred pixels tall;
		* `single-auto` preserves the source for larger renders and generates one
		* downsampled atlas only when the effective on-screen scale warrants it.
		*/
		const TEXTURE_OPTIONS = { lod: "single-auto" };
		/** Recursively release the activation without invalidating shared texture caches. */
		const DESTROY_OPTIONS = { children: true };
		/** Remove only this activation's canvas; `true` would release Pixi globals. */
		const RENDERER_DESTROY_OPTIONS = { removeView: true };
		/** Ignore hidden/zero boxes and keep Pixi dimensions stable and integral. */
		function normalizeRendererSize(width, height) {
			if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return void 0;
			return {
				width: Math.max(1, Math.round(width)),
				height: Math.max(1, Math.round(height))
			};
		}
		/** Fit the model from its unscaled dimensions into the current Pixi screen. */
		function layoutModel(app, model, sourceSize, config) {
			const fit = Math.min(app.renderer.width / sourceSize.width, app.renderer.height / sourceSize.height) * .92;
			model.scale.set(fit * (config.scale ?? 1));
			model.anchor.set(.5);
			model.position.set(app.renderer.width / 2 + (config.translate?.x ?? 0), app.renderer.height / 2 + (config.translate?.y ?? 0));
		}
		let vendorConfigured = false;
		/** Configure pixi extensions + the Cubism SDK once per page. */
		function configureOnce(vendor) {
			if (vendorConfigured) return;
			vendorConfigured = true;
			vendor.extensions.add(vendor.Live2DPlugin);
			vendor.configureCubismSDK({ memorySizeMB: 32 });
		}
		/** Fail-closed config validation (contract: unknown manifest block in). */
		function validateLive2dConfig(config) {
			if (typeof config !== "object" || config === null) throw new Error("live2d config is not an object");
			const source = config;
			if (typeof source.modelUrl !== "string" || source.modelUrl === "") throw new Error("live2d config modelUrl is required");
			const motions = source.motions;
			if (typeof motions !== "object" || motions === null || typeof motions.idle !== "string") throw new Error("live2d config motions.idle is required");
			return config;
		}
		/** The live2d renderer implementation. */
		const live2dRenderer = {
			id: "live2d",
			apiVersion: PET_RENDERER_API_VERSION,
			validateConfig: validateLive2dConfig,
			mount(ctx, config) {
				let disposed = false;
				let app;
				let model;
				let modelAttached = false;
				let modelSourceSize;
				let resizeObserver;
				let resizeTracking = false;
				let errorListener;
				let unsubscribe;
				/** The motion group the current phase maps to (resume target after taps). */
				let phaseGroup = config.motions.idle;
				let tapPlaying = false;
				const stopResizeTracking = () => {
					resizeTracking = false;
					resizeObserver?.disconnect();
					resizeObserver = void 0;
				};
				const resizeRenderer = (pixiApp, width, height) => {
					const next = normalizeRendererSize(width, height);
					if (disposed || !resizeTracking || next === void 0) return;
					if (pixiApp.renderer.width === next.width && pixiApp.renderer.height === next.height) return;
					pixiApp.renderer.resize(next.width, next.height);
					if (model !== void 0 && modelSourceSize !== void 0) layoutModel(pixiApp, model, modelSourceSize, config);
				};
				const trackContainerSize = (pixiApp) => {
					if (typeof ResizeObserver === "undefined") return;
					resizeTracking = true;
					resizeObserver = new ResizeObserver((entries) => {
						const entry = entries.find((candidate) => candidate.target === ctx.container);
						if (entry === void 0) return;
						resizeRenderer(pixiApp, entry.contentRect.width, entry.contentRect.height);
					});
					resizeObserver.observe(ctx.container);
					resizeRenderer(pixiApp, ctx.container.clientWidth, ctx.container.clientHeight);
				};
				/** Release every resource currently owned by this activation exactly once. */
				const destroyResources = () => {
					stopResizeTracking();
					unsubscribe?.();
					unsubscribe = void 0;
					const currentApp = app;
					const currentModel = model;
					const modelOwnedByApp = currentApp !== void 0 && modelAttached;
					app = void 0;
					model = void 0;
					modelSourceSize = void 0;
					modelAttached = false;
					try {
						if (currentModel !== void 0 && !modelOwnedByApp) currentModel.destroy(DESTROY_OPTIONS);
					} finally {
						currentApp?.destroy(RENDERER_DESTROY_OPTIONS, DESTROY_OPTIONS);
					}
				};
				const playGroup = (group) => {
					if (model === void 0) return;
					const groups = model.internalModel.settings.motions ?? {};
					const count = Array.isArray(groups[group]) ? groups[group].length : 0;
					if (count === 0) {
						if (group !== config.motions.idle) playGroup(config.motions.idle);
						return;
					}
					const index = count > 1 ? Math.floor(Math.random() * count) : 0;
					model.motion(group, index);
				};
				const applyPhase = (phase) => {
					phaseGroup = config.motions[phase] ?? config.motions.idle;
					playGroup(phaseGroup);
					const expression = config.expressions?.[phase];
					if (expression !== void 0 && model !== void 0) model.expression(expression);
				};
				const boot = async () => {
					if (!await ensureCubismCore()) {
						if (!disposed) errorListener?.("core-missing");
						return;
					}
					const vendor = await ensureLive2dVendor();
					if (vendor === void 0) {
						if (!disposed) errorListener?.("vendor-missing");
						return;
					}
					configureOnce(vendor);
					const pixiApp = new vendor.Application();
					const initialSize = normalizeRendererSize(ctx.container.clientWidth, ctx.container.clientHeight) ?? {
						width: 160,
						height: 174
					};
					try {
						await pixiApp.init({
							width: initialSize.width,
							height: initialSize.height,
							backgroundAlpha: 0,
							antialias: true,
							autoDensity: true,
							preference: "webgl"
						});
					} catch (error) {
						try {
							pixiApp.destroy(RENDERER_DESTROY_OPTIONS, DESTROY_OPTIONS);
						} catch {}
						throw error;
					}
					if (disposed) {
						pixiApp.destroy(RENDERER_DESTROY_OPTIONS, DESTROY_OPTIONS);
						return;
					}
					app = pixiApp;
					pixiApp.canvas.style.display = "block";
					pixiApp.canvas.style.width = "100%";
					pixiApp.canvas.style.height = "100%";
					ctx.container.appendChild(pixiApp.canvas);
					trackContainerSize(pixiApp);
					const loaded = await vendor.Live2DModel.from(config.modelUrl, {
						autoUpdate: false,
						autoHitTest: false,
						autoFocus: false,
						textureOptions: TEXTURE_OPTIONS
					});
					model = loaded;
					if (disposed) {
						destroyResources();
						return;
					}
					modelSourceSize = {
						width: Math.max(1, loaded.width),
						height: Math.max(1, loaded.height)
					};
					layoutModel(pixiApp, loaded, modelSourceSize, config);
					pixiApp.stage.addChild(loaded);
					modelAttached = true;
					loaded.automator.autoUpdate = true;
					loaded.on("motionFinish", () => {
						if (tapPlaying) {
							tapPlaying = false;
							playGroup(phaseGroup);
						}
					});
					applyPhase(ctx.phase.get());
					unsubscribe = ctx.phase.subscribe(applyPhase);
				};
				boot().catch(() => {
					try {
						destroyResources();
					} finally {
						if (!disposed) errorListener?.("load-failed");
					}
				});
				return {
					dispose() {
						if (disposed) return;
						disposed = true;
						destroyResources();
					},
					tap(x, y) {
						const current = model;
						if (disposed || current === void 0) return;
						const hits = current.hitTest(x, y);
						const allowed = config.hitAreas;
						if (!(allowed === void 0 ? hits.length > 0 : hits.some((name) => allowed.includes(name)))) return;
						const group = (current.internalModel.settings.motions ?? {})[TAP_GROUP];
						if (!Array.isArray(group) || group.length === 0) return;
						tapPlaying = true;
						const index = group.length > 1 ? Math.floor(Math.random() * group.length) : 0;
						current.motion(TAP_GROUP, index);
					},
					onError(listener) {
						errorListener = listener;
					}
				};
			}
		};
		//#endregion
		//#region src/client/ui-teardown.ts
		/**
		* Cross-bundle-instance teardown slot for the page-global pet root
		* (issue #785).
		*
		* A client bundle swap (HMR rebuilt frame, plugin update, duplicate
		* injection) runs a new apply body while the previous instance's fiber
		* may still be draining. Module state does not survive the swap, so a
		* closure guard only sees one apply body and the previous instance's
		* container keeps sitting on document.body: the page shows two pets
		* until a full refresh. The slot rides globalThis (which does survive)
		* so a re-apply can find the previous instance and unmount its React
		* root cleanly before mounting its own; the previous fiber's later
		* disposal stays a no-op through the idempotent teardowns.
		*/
		const SLOT = Symbol.for("dsh-pet.client-ui-teardown");
		/**
		* Claim the page-global pet UI slot with the current instance's teardown
		* (React root unmount + container removal + poll stop).
		* @param teardown - what a later instance runs to take the slot over.
		* @returns a disposer that clears the slot when the current instance's
		* UI is torn down (settings toggle, takeover, or fiber disposal).
		*/
		function registerPetUiTeardown(teardown) {
			const slot = globalThis;
			slot[SLOT] = teardown;
			return () => {
				if (slot[SLOT] === teardown) slot[SLOT] = void 0;
			};
		}
		/**
		* Run the previous instance's teardown if one is registered, so the
		* re-applying instance becomes the sole owner of the page-global pet
		* root. No-op when the previous fiber already tore down cleanly.
		*/
		function takeoverPetUiTeardown() {
			const slot = globalThis;
			const teardown = slot[SLOT];
			slot[SLOT] = void 0;
			teardown?.();
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-pet/src/client/settings-card.module.css.mjs
		const css$1 = ".kKk9aW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.kKk9aW_card:hover{border-color:var(--dsw-alias-label-dimmed)}.kKk9aW_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.kKk9aW_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.kKk9aW_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.kKk9aW_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.kKk9aW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.kKk9aW_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.kKk9aW_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.kKk9aW_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.kKk9aW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.kKk9aW_chevronOpen{transform:rotate(180deg)}.kKk9aW_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.kKk9aW_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.kKk9aW_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.kKk9aW_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.kKk9aW_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.kKk9aW_discard,.kKk9aW_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.kKk9aW_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.kKk9aW_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.kKk9aW_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.kKk9aW_discard:disabled,.kKk9aW_save:disabled{opacity:.4;cursor:default}.kKk9aW_discard:focus-visible,.kKk9aW_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.kKk9aW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.kKk9aW_field+.kKk9aW_field{border-top:1px solid var(--dsw-alias-border-l2)}.kKk9aW_head{align-items:center;gap:8px;display:flex}.kKk9aW_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.kKk9aW_badges{align-items:center;gap:8px;display:inline-flex}.kKk9aW_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.kKk9aW_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.kKk9aW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.kKk9aW_reset:disabled{cursor:default}.kKk9aW_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.kKk9aW_input,.kKk9aW_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.kKk9aW_input:focus-visible,.kKk9aW_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.kKk9aW_input:disabled,.kKk9aW_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.kKk9aW_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.kKk9aW_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.kKk9aW_selectWrap{position:relative}.kKk9aW_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.kKk9aW_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.kKk9aW_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.kKk9aW_selectChevronOpen{transform:rotate(180deg)}.kKk9aW_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.kKk9aW_selectPopupOpen{opacity:1;transform:none}.kKk9aW_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.kKk9aW_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.kKk9aW_selectOption:hover,.kKk9aW_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.kKk9aW_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.kKk9aW_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.kKk9aW_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.kKk9aW_card,.kKk9aW_header,.kKk9aW_chevron,.kKk9aW_chevronOpen,.kKk9aW_discard,.kKk9aW_save,.kKk9aW_selectChevron,.kKk9aW_selectChevronOpen,.kKk9aW_selectPopup{transition:none}}";
		const tagId$1 = "@linxin666/dsh-pet/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-pet";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "kKk9aW_badge",
			"badges": "kKk9aW_badges",
			"body": "kKk9aW_body",
			"card": "kKk9aW_card",
			"cardOpen": "kKk9aW_cardOpen",
			"chevron": "kKk9aW_chevron",
			"chevronOpen": "kKk9aW_chevronOpen",
			"description": "kKk9aW_description",
			"discard": "kKk9aW_discard",
			"failed": "kKk9aW_failed",
			"field": "kKk9aW_field",
			"footer": "kKk9aW_footer",
			"head": "kKk9aW_head",
			"headText": "kKk9aW_headText",
			"header": "kKk9aW_header",
			"headerStatic": "kKk9aW_headerStatic",
			"hint": "kKk9aW_hint",
			"input": "kKk9aW_input",
			"inputInvalid": "kKk9aW_inputInvalid",
			"invalid": "kKk9aW_invalid",
			"label": "kKk9aW_label",
			"name": "kKk9aW_name",
			"notExposed": "kKk9aW_notExposed",
			"pending": "kKk9aW_pending",
			"readOnly": "kKk9aW_readOnly",
			"reset": "kKk9aW_reset",
			"save": "kKk9aW_save",
			"select": "kKk9aW_select",
			"selectButton": "kKk9aW_selectButton",
			"selectChevron": "kKk9aW_selectChevron",
			"selectChevronOpen": "kKk9aW_selectChevronOpen",
			"selectLabel": "kKk9aW_selectLabel",
			"selectOption": "kKk9aW_selectOption",
			"selectOptionActive": "kKk9aW_selectOptionActive",
			"selectOptionSelected": "kKk9aW_selectOptionSelected",
			"selectPopup": "kKk9aW_selectPopup",
			"selectPopupClose": "kKk9aW_selectPopupClose",
			"selectPopupOpen": "kKk9aW_selectPopupOpen",
			"selectWrap": "kKk9aW_selectWrap"
		};
		//#endregion
		//#region src/client/PluginSettingsCard.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		/** A staged value field. `numeric` only hints the keypad: which drafts a field accepts is decided by its spec. */
		function ValueField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: props.invalid ? settings_card_module_css_default.inputInvalid : settings_card_module_css_default.input,
						type: "text",
						...props.numeric === true ? { inputMode: "numeric" } : {},
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		/** A staged enumerated field rendered as a select. */
		function ChoiceField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [{
							value: "",
							label: props.inheritLabel
						}, ...props.choices],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-form.ts
		/** A whole- or decimal-number field. An empty draft clears the field; any other draft that is not a finite number within the constraints blocks the save. */
		function numberField(field, constraints = {}) {
			const { integer = false, min } = constraints;
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) return void 0;
					if (integer && !Number.isInteger(parsed)) return void 0;
					if (min !== void 0 && parsed < min) return void 0;
					return {
						kind: "set",
						value: parsed
					};
				}
			};
		}
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return {
						kind: "set",
						value: true
					};
					if (trimmed === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/** An enumerated string field; only the listed choices are accepted. An empty draft clears the field. */
		function choiceField(field, choices) {
			return {
				field,
				format: (value) => typeof value === "string" && choices.includes(value) ? value : "",
				parse: (text) => {
					if (text === "") return { kind: "clear" };
					return choices.includes(text) ? {
						kind: "set",
						value: text
					} : void 0;
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			/** The scope subscription installed in the constructor; released by dispose(). */
			disposeScope;
			disposed = false;
			saving = false;
			failed = false;
			failedReason;
			/** @param scope - the bound settings scope for this card's namespace. */
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.disposeScope = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Release the scope subscription and every bound store listener. The card
			* must call this on teardown; later calls are no-ops.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disposeScope();
				this.listeners.clear();
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed,
					...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.failedReason = void 0;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			*
			* When the scope carries the optional batch surface (the dsh-web-ui
			* bridge scope), every planned write rides one mutation so cross-field
			* validate hooks (baseURL+model) judge the batch as a unit instead of
			* deadlocking on per-field writes. Otherwise the per-field loop runs.
			* A field lands only when the Host reports it held the staged value; a
			* landed field's draft is dropped, a failed one stays staged for the user.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const valid = plan.filter((item) => item.run !== void 0);
				if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
				const plannedWrites = valid.map((item) => item.op);
				const pending = /* @__PURE__ */ new Map();
				for (const item of plan) pending.set(item.field, this.staged.get(item.field));
				this.saving = true;
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
				const landed = /* @__PURE__ */ new Set();
				const batch = this.batchedScope();
				if (batch !== void 0) {
					const result = await batch.mutate(plannedWrites);
					if (result.ok) {
						for (const field of result.fields) if (field.landed) landed.add(field.field);
					} else this.failedReason = result.message;
				} else for (const item of valid) if (await item.run()) landed.add(item.field);
				for (const [field, before] of pending) if (landed.has(field) && this.staged.get(field) === before) this.staged.delete(field);
				this.saving = false;
				this.failed = landed.size !== pending.size;
				this.publish();
			}
			/** The scope's batch surface when it supports one; undefined conservatively otherwise. */
			batchedScope() {
				const candidate = this.scope;
				return typeof candidate?.mutate === "function" ? candidate : void 0;
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							op: {
								field,
								op: "unset"
							},
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						op: {
							field,
							op: "set",
							value: write.value
						},
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				if (this.specOf(field).secret) return true;
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-pet/src/client/settings-section.module.css.mjs
		const css = ".t0P0pa_sectionList{margin:0;padding:0;list-style:none}.t0P0pa_diagnostics{border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);border-radius:8px;margin:8px 0;padding:8px 12px;font-size:12px}.t0P0pa_diagnosticsTitle{color:var(--dsw-alias-label-primary);margin-bottom:4px;font-weight:600;display:block}.t0P0pa_diagnostics ul{margin:0;padding-left:16px}.t0P0pa_diagnostics li[data-level=error]{color:var(--dsw-alias-label-error,#c04848)}";
		const tagId = "@linxin666/dsh-pet/settings-section.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-pet";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_section_module_css_default = {
			"diagnostics": "t0P0pa_diagnostics",
			"diagnosticsTitle": "t0P0pa_diagnosticsTitle",
			"sectionList": "t0P0pa_sectionList"
		};
		//#endregion
		//#region src/client/PetSettingsCard.tsx
		/** Fetch the registry list (the same data the sprite renders from). */
		async function fetchPetChoices() {
			const response = await fetch("/api/pet/pets");
			if (!response.ok) throw new Error("pet pets failed: " + response.status);
			return await response.json();
		}
		/** Fetch the registry diagnostics (v1 migration hints, invalid entries). */
		async function fetchPetDiagnostics() {
			const response = await fetch("/api/pet/diagnostics");
			if (!response.ok) throw new Error("pet diagnostics failed: " + response.status);
			return (await response.json()).diagnostics ?? [];
		}
		/** Bridges the 'pet' scope onto the card's staged form. */
		var PetSettingsCardController = class {
			form;
			store;
			petChoices = [];
			petLabels = /* @__PURE__ */ new Map();
			diagnostics = [];
			loaded = false;
			attempts = 0;
			disposed = false;
			/** Pending deferred-load or retry timer; cancelled by dispose(). */
			pendingTimer;
			/** @param scope - the bound settings scope for the 'pet' namespace. */
			constructor(scope) {
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					booleanField("decorationEnabled"),
					booleanField("visible"),
					numberField("size"),
					numberField("right"),
					numberField("bottom"),
					choiceField("petId", this.petChoices)
				]);
				this.store = this.form.bind(() => this.projection());
				this.pendingTimer = window.setTimeout(() => {
					this.pendingTimer = void 0;
					if (this.disposed) return;
					this.loadPets();
					this.loadDiagnostics();
				}, 0);
			}
			/** Fetch registry diagnostics once (soft-fail: an empty list on error). */
			async loadDiagnostics() {
				try {
					this.diagnostics = await fetchPetDiagnostics();
					if (this.disposed) return;
					this.store.set(this.projection());
				} catch {
					this.diagnostics = [];
				}
			}
			/** Resolve the registry choices once (retried a few times on failure). */
			async loadPets() {
				if (this.loaded || this.disposed) return;
				try {
					const list = await fetchPetChoices();
					if (this.disposed) return;
					this.petChoices.splice(0, this.petChoices.length, ...list.map((choice) => choice.id));
					for (const choice of list) this.petLabels.set(choice.id, choice.displayName);
					this.loaded = true;
					this.store.set(this.projection());
				} catch {
					if (this.disposed) return;
					this.attempts += 1;
					if (this.attempts < 3) this.pendingTimer = window.setTimeout(() => {
						this.pendingTimer = void 0;
						if (this.disposed) return;
						this.loadPets();
					}, 3e3);
				}
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					decorationEnabled: this.form.field("decorationEnabled"),
					visible: this.form.field("visible"),
					size: this.form.field("size"),
					right: this.form.field("right"),
					bottom: this.form.field("bottom"),
					petId: this.form.field("petId"),
					petChoices: this.petChoices.map((id) => ({
						value: id,
						label: this.petLabels.get(id) ?? id
					})),
					petDiagnostics: this.diagnostics
				};
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { petSettingsCard: this.store },
					...this.form.actions()
				};
			}
			/**
			* Release the card's scope subscription, bound stores and pending load
			* timers; the slot disposer calls this on teardown.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				if (this.pendingTimer !== void 0) {
					window.clearTimeout(this.pendingTimer);
					this.pendingTimer = void 0;
				}
				this.form.dispose();
			}
		};
		/**
		* Render the pet settings card.
		* @param props - locale copy, the card snapshot, and its form actions.
		* @returns the card.
		*/
		function PetSettingsCard(props) {
			const { t } = props;
			const state = props.usePetSettingsCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				state,
				onSave: props.save,
				onDiscard: props.discard,
				alwaysOpen: true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-pet-enabled",
						label: t("settings.enabled"),
						hint: t("settings.enabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.enabled,
						onEdit: (text) => {
							props.edit("enabled", text);
						},
						onReset: () => {
							props.resetField("enabled");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-pet-decoration",
						label: t("settings.decoration"),
						hint: t("settings.decorationHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.decorationEnabled,
						onEdit: (text) => {
							props.edit("decorationEnabled", text);
						},
						onReset: () => {
							props.resetField("decorationEnabled");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
						id: "settings-pet-pet",
						label: t("settings.pet"),
						hint: t("settings.petHint"),
						inheritLabel: t("settings.inherit"),
						...fieldProps,
						...state.petId,
						choices: state.petChoices,
						onEdit: (text) => {
							props.edit("petId", text);
						},
						onReset: () => {
							props.resetField("petId");
						}
					}),
					state.petDiagnostics.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: settings_section_module_css_default.diagnostics,
						"data-dsh-part": "diagnostics",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_section_module_css_default.diagnosticsTitle,
							children: t("settings.diagnosticsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: state.petDiagnostics.map((diagnostic, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							"data-level": diagnostic.level,
							children: diagnostic.message
						}, index)) })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-pet-visible",
						label: t("settings.visible"),
						hint: t("settings.visibleHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.visible,
						onEdit: (text) => {
							props.edit("visible", text);
						},
						onReset: () => {
							props.resetField("visible");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-pet-size",
						label: t("settings.size"),
						hint: t("settings.sizeHint"),
						numeric: true,
						...fieldProps,
						...state.size,
						onEdit: (text) => {
							props.edit("size", text);
						},
						onReset: () => {
							props.resetField("size");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-pet-right",
						label: t("settings.right"),
						hint: t("settings.rightHint"),
						numeric: true,
						...fieldProps,
						...state.right,
						onEdit: (text) => {
							props.edit("right", text);
						},
						onReset: () => {
							props.resetField("right");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-pet-bottom",
						label: t("settings.bottom"),
						hint: t("settings.bottomHint"),
						numeric: true,
						...fieldProps,
						...state.bottom,
						onEdit: (text) => {
							props.edit("bottom", text);
						},
						onReset: () => {
							props.resetField("bottom");
						}
					})
				]
			});
		}
		/** Render the pet settings card as a first-level settings page. */
		function PetSettingsSection(props) {
			const { t, usePetSettingsCard, save, discard, edit, resetField } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: settings_section_module_css_default.sectionList,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetSettingsCard, {
					t,
					usePetSettingsCard,
					save,
					discard,
					edit,
					resetField
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Chinese copy. */
		const zh = {
			"pet.feed": "喂食",
			"pet.hide": "隐藏",
			"pet.rename": "改名",
			"pet.confirm": "确定",
			"pet.namePlaceholder": "输入新名字",
			"pet.summon": "召唤{name}",
			"pet.rank": "亲密度 {rank}",
			"pet.points": "{points} 点",
			"pet.treats": "小鱼干 ×{n}",
			"pet.state.loading": "宠物正在赶来…",
			"pet.state.error": "宠物迷路了（连接失败）",
			"pet.renderer.unavailable": "这只宠物需要的渲染器（{renderer}）在当前版本不可用。",
			"pet.live2d.core-missing": "Live2D 核心未安装：请把官方 live2dcubismcore.min.js 放入 $DSH_HOME/pets/.runtime/ 后刷新（步骤见宠物插件 README）。",
			"pet.live2d.vendor-missing": "Live2D 组件缺失，请升级宠物插件。",
			"pet.live2d.load-failed": "Live2D 模型加载失败，请检查该宠物目录的完整性。",
			"pet.openSessionHint": "点击跳转到对应会话",
			"pet.moreSessions": "展开其余 {n} 个会话的气泡",
			"pet.collapseSessions": "收起会话气泡",
			"settings.title": "宠物",
			"settings.diagnosticsTitle": "宠物目录诊断",
			"settings.description": "选择宠物并调整它的显示布局。",
			"settings.pet": "宠物",
			"settings.petHint": "选择显示哪只宠物；每只宠物独立命名，可在宠物悬浮面板改名。",
			"settings.enabled": "启用宠物",
			"settings.enabledHint": "关闭后隐藏宠物并停止轮询，可在设置里重新启用。",
			"settings.decoration": "状态装饰",
			"settings.decorationHint": "在宠物状态气泡里显示喷水鲸鱼等状态装饰；关闭后气泡只剩文字。",
			"settings.visible": "显示宠物",
			"settings.visibleHint": "关闭后宠物隐藏，可从聊天输入区重新召唤。",
			"settings.size": "大小（px）",
			"settings.sizeHint": "精灵单元高度，范围 32–512。",
			"settings.right": "距右侧（px）",
			"settings.rightHint": "距视口右边缘的水平内缩距离。",
			"settings.bottom": "距底部（px）",
			"settings.bottomHint": "距视口底边的垂直内缩距离。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。",
			"settings.readOnly": "当前部署的设置只读。",
			"settings.expand": "展开设置",
			"settings.collapse": "收起设置",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃",
			"settings.unsaved": "未保存",
			"settings.saveFailed": "部署未接受这些值，已保留供你修改。",
			"settings.invalidNumber": "请输入数字，留空则使用默认值。"
		};
		/** English copy. */
		const en = {
			"pet.feed": "Feed",
			"pet.hide": "Hide",
			"pet.rename": "Rename",
			"pet.confirm": "OK",
			"pet.namePlaceholder": "Enter a new name",
			"pet.summon": "Summon {name}",
			"pet.rank": "Affinity {rank}",
			"pet.points": "{points} pts",
			"pet.treats": "Treats ×{n}",
			"pet.state.loading": "The pet is on its way…",
			"pet.state.error": "The pet is lost (connection failed)",
			"pet.renderer.unavailable": "This pet needs a renderer ({renderer}) that is not available in this build.",
			"pet.live2d.core-missing": "Live2D Cubism Core is not installed: place the official live2dcubismcore.min.js under $DSH_HOME/pets/.runtime/ and refresh (see the pet plugin README).",
			"pet.live2d.vendor-missing": "The Live2D component is missing; please update the pet plugin.",
			"pet.live2d.load-failed": "The Live2D model failed to load; check the pet directory is complete.",
			"pet.openSessionHint": "Click to jump to this session",
			"pet.moreSessions": "Expand {n} more session bubbles",
			"pet.collapseSessions": "Collapse session bubbles",
			"settings.title": "Pet",
			"settings.diagnosticsTitle": "Pet directory diagnostics",
			"settings.description": "Pick a pet and tune its display layout.",
			"settings.pet": "Pet",
			"settings.petHint": "Choose which pet shows. Names are stored per pet; rename from the pet hover panel.",
			"settings.enabled": "Enable the pet",
			"settings.enabledHint": "When off, the pet hides and polling stops; re-enable it here.",
			"settings.decoration": "Status decoration",
			"settings.decorationHint": "Show ornaments like the spouting whale inside the pet status bubbles; when off, bubbles stay text-only.",
			"settings.visible": "Show the pet",
			"settings.visibleHint": "When off, the pet hides; summon it again from the input row.",
			"settings.size": "Size (px)",
			"settings.sizeHint": "Sprite cell height, 32–512.",
			"settings.right": "Right inset (px)",
			"settings.rightHint": "Horizontal inset from the viewport right edge.",
			"settings.bottom": "Bottom inset (px)",
			"settings.bottomHint": "Vertical inset from the viewport bottom edge.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES allowlist and restart.",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.expand": "Show settings",
			"settings.collapse": "Hide settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default."
		};
		/**
		* Active dictionary, picked by the document language at call time. The pet
		* mounts as a global floating surface (not a session-scoped slot), so it has
		* no framework locale seat and resolves its copy the same tiny way the
		* task-board's DOM-injected surface does.
		*/
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? en : zh;
		}
		/**
		* Translate a key with optional `{name}` template params. Mirrors the slot
		* `Translate` contract `(key, params?) => string` so it can be handed to the
		* same components that used to receive the framework-injected `t` seat. The
		* key is typed loosely (`string`) so the function is assignable to the slot's
		* `TranslateNS<'pet'>` (whose key domain also spans the shared common
		* vocabulary); a missing key degrades to the key itself rather than throwing.
		*/
		function t(key, params) {
			let text = dictionary()[key] ?? key;
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region src/client/index.ts
		/** Same-origin JSON fetch helper (GET without body, POST with JSON body). */
		async function petFetch(path, body) {
			const response = await fetch(path, body === void 0 ? {} : {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			if (!response.ok) throw new Error("pet " + path + " failed: " + response.status);
			return await response.json();
		}
		/** The live host API instance (always defined; failures surface per call). */
		const petApi = {
			state: () => petFetch("/api/pet/state"),
			pets: () => petFetch("/api/pet/pets"),
			interact: (kind) => petFetch("/api/pet/interact", { kind }),
			setVisible: (visible) => petFetch("/api/pet/set-visible", { visible }),
			setConfig: (patch) => petFetch("/api/pet/set-config", patch),
			setName: (name) => petFetch("/api/pet/set-name", { name }),
			setPet: (petId) => petFetch("/api/pet/set-pet", { petId })
		};
		/** Poll interval for the host snapshot. */
		const POLL_MS = 2e3;
		/** Settings namespace the pet settings card edits (the Host plugin registers it). */
		const PET_SETTINGS_NS = "pet";
		/** Required services (sessions powers bubble-to-session navigation). */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope",
			"remote",
			"sessions"
		];
		/**
		* Client plugin body: register dictionaries, mount the global pet entry and
		* poll loop while the plugin is enabled, and seat the settings card as a
		* first-level settings section.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register("pet", {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "pet: dictionaries");
			defaultPetRendererRegistry.register(live2dRenderer);
			const settingsScope = (ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: PET_SETTINGS_NS });
			const enabled = () => {
				const snapshot = settingsScope.getSnapshot();
				return snapshot.status === "ready" ? snapshot.value?.enabled ?? true : snapshot.status === "unavailable";
			};
			const petSettings = new PetSettingsCardController(settingsScope);
			ctx.slots.inject("settings.section", () => {
				try {
					const unregister = ctx.slots.register({
						name: "settings.section",
						id: "pet",
						order: 130,
						label: () => ctx.locale.bind("pet")("settings.title"),
						locale: "pet",
						inject: () => petSettings.inject()
					}, PetSettingsSection);
					return () => {
						unregister();
						petSettings.dispose();
					};
				} catch {
					return () => {};
				}
			});
			let disposeUi;
			let clearUiTeardown;
			let uiDead = false;
			const killUi = () => {
				if (uiDead) return;
				uiDead = true;
				clearUiTeardown?.();
				clearUiTeardown = void 0;
				disposeUi?.();
				disposeUi = void 0;
			};
			const syncUi = () => {
				if (!uiDead && enabled() && disposeUi === void 0) {
					const petStore = createPetStore().create();
					const setSnapshot = petStore.actions.setSnapshot;
					const setPets = petStore.actions.setPets;
					const setState = petStore.actions.setState;
					const setFeedback = petStore.actions.setFeedback;
					let petsLoaded = false;
					let stateSeq = 0;
					const pollNow = () => {
						if (!petsLoaded) petApi.pets().then((list) => {
							petsLoaded = true;
							setPets(list);
						}, () => {});
						const seq = stateSeq + 1;
						stateSeq = seq;
						petApi.state().then((snapshot) => {
							if (seq !== stateSeq) return;
							setSnapshot(snapshot);
						}, () => {
							if (seq !== stateSeq) return;
							setState("error", "pet.state transport error");
						});
					};
					const disposePoll = ctx.effect(() => {
						let timer;
						const stop = () => {
							if (timer !== void 0) {
								window.clearInterval(timer);
								timer = void 0;
							}
						};
						const start = () => {
							if (timer === void 0 && document.visibilityState === "visible") timer = window.setInterval(pollNow, POLL_MS);
						};
						const onVisibility = () => {
							if (document.visibilityState === "visible") {
								pollNow();
								start();
							} else stop();
						};
						start();
						document.addEventListener("visibilitychange", onVisibility);
						return () => {
							stop();
							document.removeEventListener("visibilitychange", onVisibility);
						};
					}, "pet: poll");
					const sessions = ctx.sessions;
					const openSession = (sessionId) => {
						if (sessions.list.getSnapshot().byId[sessionId] === void 0) return;
						sessions.open(sessionId);
					};
					const injected = () => ({
						store: petStore,
						ensure: pollNow,
						openSession,
						pet: () => {
							petApi.interact("pet").then((result) => {
								setFeedback({
									text: result.reaction,
									kind: "pet",
									at: Date.now()
								});
							}, () => {});
						},
						feed: () => {
							petApi.interact("feed").then((result) => {
								setFeedback({
									text: result.reaction,
									kind: "feed",
									at: Date.now()
								});
							}, () => {});
						},
						hide: () => {
							petApi.setVisible(false).then(() => {
								pollNow();
							}, () => {});
						},
						summon: () => {
							petApi.setVisible(true).then(() => {
								pollNow();
							}, () => {});
						},
						dragEnd: (right, bottom) => {
							petApi.setConfig({
								right,
								bottom
							}).then(() => {
								pollNow();
							}, () => {});
						},
						rename: (name) => {
							petApi.setName(name).then((result) => {
								if (result.ok) pollNow();
							}, () => {});
						},
						feedbackDone: () => {
							setFeedback(null);
						}
					});
					takeoverPetUiTeardown();
					for (const stale of Array.from(document.querySelectorAll("div[data-dsh-pet-root]"))) stale.remove();
					const container = document.createElement("div");
					container.dataset.dshPetRoot = "";
					container.dataset.dshPlugin = "pet";
					document.body.appendChild(container);
					const petRoot = (0, react_dom_client.createRoot)(container);
					petRoot.render((0, react.createElement)(PetDockEntry, {
						...injected(),
						t
					}));
					let uiGone = false;
					disposeUi = () => {
						if (uiGone) return;
						uiGone = true;
						clearUiTeardown?.();
						clearUiTeardown = void 0;
						petRoot.unmount();
						container.remove();
						disposePoll();
						disposeUi = void 0;
					};
					clearUiTeardown = registerPetUiTeardown(() => {
						uiDead = true;
						disposeUi?.();
					});
				} else if (!uiDead && !enabled() && disposeUi !== void 0) {
					disposeUi();
					disposeUi = void 0;
				}
			};
			const unsubscribeSettings = settingsScope.subscribe(syncUi);
			ctx.effect(() => () => {
				unsubscribeSettings();
				killUi();
			}, "pet: client lifecycle");
			syncUi();
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map