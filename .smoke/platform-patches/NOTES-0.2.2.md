# Platform patches re-derived for DSH 0.2.2-rc.2 (dsh-vscode)

Branch point: `@deepseek-ai/dsh@0.1.5-rc.2` → `0.2.2-rc.2`.
`vendor/node_modules` is a clean npm install of 0.2.2-rc.2; reference trees used:

- `.tmp-vendor/platform-rc2/node_modules` — clean 0.1.5-rc.2 install (recover the local diff)
- `.tmp-vendor/vendor-015` — old host tree (only `@deepseek-ai/dsh` subset; not used for the
  two vendor packages below, which were recovered from `git show HEAD:...`)
- `.tmp-vendor/stage-022rc2/node_modules` — clean 0.2.2-rc.2 install (baseline for "did upstream fix it")
- `vendor/node_modules` — the current, patched tree

`python .smoke/platform-patches.py verify` → 6/6 `ok`, exit 0 (see §Verify output).

---

## 1. Patch-by-patch disposition

| # | Store file (manifest `storedAs`) | Disposition | Old anchor (0.1.5) | New anchor (0.2.2, patched store) | Evidence for disposition | Guard test |
|---|---|---|---|---|---|---|
| 1 | `dsh-session-format-v0-to-v1/lib/index.js` | **KEEP-PORTED** (3 of 4 tolerances; the 4th is fixed upstream) | plugin-compat region + `contentBlockValue` + `pluginSourceValue` + `subagentDescriptorValue` coercion | `plugin-compat.js` helper region at `:263-329`; `RELEASED_CONTENT_BLOCK_MEMBERS` + drop at `:721-733`; plugin-source drop at `:1006-1009`; summary drop at `:1038-1039`; **descriptor coercion removed** | 0.2.2 `SUBAGENT_DESCRIPTOR_VERSIONS = [1,2,3]` (`lib/index.js:1288-1293` pristine), `assertReleasedEventPayload` early-returns only for unknown versions (`:1608-1612` pristine). The three remaining shapes are still exact-refused by 0.2.2 (`contentBlockValue` `:650-687`, `pluginSourceValue` `:917-948` pristine). | synthetic behaviour probe (below); `.smoke/session-history-check.mjs` (needs a metadata fix, §4) |
| 2 | `dsh-api-settings-controller/lib/index.js` | **KEEP-PORTED** | `DSH_EMBEDDED` branch before `openTextFile` in the old settings handler | `:454-467` — same branch in `openSettingsDocument` | 0.2.2 `openSettingsDocument` (`lib/index.js:443-461` pristine) still calls `openTextFile` unconditionally; nothing reads `DSH_EMBEDDED`. `internals.openTextFile` seam unchanged. | `.smoke/embedded-open-settings-test.mjs` — **PASS 10/10** |
| 3 | `dsh-subprocess-local/lib/index.js` | **DROPPED-FIXED-UPSTREAM** | `launchWindowsJob` spawn options got `windowsHide: true` | — | 0.2.2 `launchWindowsJob` already passes `windowsHide: true` (`lib/index.js:788` pristine; old clean had it absent). 0.2.2's fallback `spawnSubprocess` still has `windowsHide: platform === "win32"` (`lib/runner-launch-CKTiL8M8.js:1053`), and the runner chunk even gained `windowsHide: true` at two more spawn sites (`:166`, `:741`). Nothing left to patch. | `.smoke/windows-hide-test.mjs` part 1/2 (needs the renamed chunk, §4) |
| 4 | ~~`dsh-session-persistence-jsonl/lib/index.js`~~ | **RETIRED-UNUSED** (no store file, no manifest entry; package reverted byte-identical to clean 0.2.2) | `inspect(id, options)` inserted before `open` | — (removed in patched tree) | Porting was possible (0.2.2's base contract still has no `inspect`, and the jsonl backend has none: `dsh-session-persistence/src/index.ts:144-211`, `JsonlSessionPersistence` `lib/index.js:2403` with `create:2465` / `open:2488`), but it has **no consumer in this build**: its only caller was the `@dsh-undo/*` bundles, removed in commit `9a7bf80c` (replaced by `dsh-rewind-plugin`); `@mlgbnb/dsh-archive-manager` reads `session.jsonl.zstd` with its own decoder and `dsh-better-sidebar` uses `open(id,'read')`. Kept only as a defensive seam during re-derivation, then retired on Lead decision so it does not become re-derivation cost on the next upgrade. The package now shows zero diff vs `.tmp-vendor/stage-022rc2`; `.smoke/persistence-inspect-test.mjs` is deleted by the Lead. | — (guard deleted with the patch) |
| 5 | `dsh-win32-process/lib/index.js` | **DROPPED-FIXED-UPSTREAM** | both `STARTUPINFOW` sites `dwFlags: 256 → 257` + `wShowWindow: 0`; `CREATE_NO_WINDOW` on the ordinary current-token creation | — | 0.2.2 already has `dwFlags: 257` + `wShowWindow: 0` on **both** sites (`lib/index.js:459-461` piped/restricted, `:627-629` job/restricted+ordinary, pristine). Doc comments now state "New console windows start hidden…"/"hidden initial windows". Restricted creations still pass flags `0` (`:466`) / `4` (`:701`), so the accidental `CREATE_NO_WINDOW` risk the old patch avoided is absent upstream. The one remaining old delta (`CREATE_NO_WINDOW` on `spawnCurrentTokenJobProcess` `:712`) is superseded by upstream's SW_HIDE on the same creation, so re-porting it would be redundant. | `.smoke/windows-hide-test.mjs` part 1b/3 — asserts the upstream shape directly |
| 6 | `dsh-api-session-controller/lib/index.js` | **KEEP-PORTED** (cut loop dropped as fixed upstream; `inbox.clear()` kept) | `cut` loop stopped at `turn/start` + `user/message` + `agent/inbox/spliced`; `handle.agent.inbox.clear()` after `agents.create` | only `inbox.clear()` remains: `:863-869` | 0.2.2 implements the cut natively: `latestCompletedPrefixBoundary` (`lib/index.js:686-695` pristine) starts at the last `turn/end` and breaks before the next `turn/start` / surface-append `user/message` / `agent/inbox/spliced`; `fork()` uses `seed = buildForkSeed(source.events, boundary)` (`:835-837`). The seed is still the verbatim prefix, so an `agent/inbox/spliced` written **before** the boundary's `turn/end` still rehydrates the parent's next-turn/next-step inbox into the child — 0.2.2 has no inbox reset in any fork path (`grep .inbox` in the controller finds only queue reads). Ported that one line (handle captured from `agents.create`; `AgentHandle.agent` still exists). | none dedicated (the original fork fixes were verified by commits 8db6b382 / dcc3d00b / 57f9f717) |
| 7 | `dsh-api-session-controller/lib/types/commands.js` | **KEEP-PORTED** (same one-line port) | duplicate cut loop + `inbox.clear()` | `:274-280` | `lib/types/commands.js` is now hand-written source in 0.2.2 and has the same `latestCompletedPrefixBoundary` (`:79-90`) + `buildForkSeed` (`:248`), so only `inbox.clear()` is ported. | same as #6 |
| 8 | `dsh-sandbox-local/lib/index.js` | **KEEP-PORTED** | `defaultProbeWindowsAcl` spawn options `+ windowsHide: true` | `:176-181` | 0.2.2 `defaultProbeWindowsAcl` (`lib/index.js:157-176` pristine) still spawns with `{ timeout, stdio: "ignore" }` only. | `.smoke/windows-hide-test.mjs` part 1b (last check) |
| 9 | `dsh-web-frontend/dist/index.html` | **KEEP-PORTED (newly captured)** | — (never in the store; recovered from `git show e16b17ea -- …/dist/index.html`) | script block inserted before the module entry (`:13-52` of the store file) | 0.2.2 did **not** fix it for plugins: its own bundles added a private copy helper (try `clipboard.writeText`, then `execCommand`) but bundled third-party clients still call `navigator.clipboard.writeText` directly (`dsh-mnemon/lib/client.js:6179`, `dsh-mnemon-source-memory-spaces/lib/client.js:1270,2909`). The old SPA-wide override is the only thing covering them. Verified served end-to-end (below). | boot assertion below; `.smoke/boot-test.mjs` / `extension-proxy-test` cover HTTP serving |

### Not a patch: `dsh-client-ui-settings-models/lib/client.js` — **DROPPED-FIXED-UPSTREAM (superseded)**

The never-captured model-capability UI edit (commit `d38d1214`: "supports image" checkbox writing
`input:["text","image"]`, "reasoning model" toggle writing `reasoningEfforts:{low,high,max}`, plus
immediate persist via `onPersistModels`) is **superseded by a richer native implementation** in
0.2.2, so re-porting the 0.1.5 delta would duplicate controls and its anchors no longer exist:

- `src/client/ModelInputTypes.tsx:32-61` — native text/image checkbox set used by **both** editors
  (`ModelRow.tsx:172-175`; DeepSeek `inputModalities`, pi-ai `input`).
- `src/client/ModelReasoningEfforts.tsx:129+` — native reasoning-level editor (off/low/medium/high
  initially, per-level wire value); wired at `ModelRow.tsx:176-183`, props from
  `ModelListEditor.tsx:356-361` (`reasoningLevels`).
- Composer renders declared levels natively: `dsh-client-ui-model-selection/src/client/ModelSelect.tsx:129-149`.
- `max` remains a valid level in 0.2.2 (`dsh-llm-pi-ai/lib/index.js:307-315` THINKING_LEVELS), so the
  old `{low,high,max}` shape is still accepted by the adapter.
- The compiled `lib/client.js` confirms it ships (`ModelInputTypes`, `reasoningLevels`,
  `ModelReasoningEfforts` present; 245 KB vs 139 KB in 0.1.5).

Assumption recorded for the Lead: only the **immediate-persist** behaviour of the old patch is not
reproduced (0.2.2 capability toggles persist through the card's Apply, not on toggle). That was a UX
nicety added in the same commit, not the capability itself; re-adding it would mean editing
0.2.2's React source and rebuilding its bundle, which is outside this migration's scope.

Because the capability UI is now upstream rather than a stored patch, `platform-patches.py verify`
cannot guard it. Suggested regression guard (Lead owns `.smoke/*.mjs`): assert the shipped
`vendor/.../dsh-client-ui-settings-models/lib/client.js` still contains `ModelInputTypes`,
`reasoningLevels` and `ModelReasoningEfforts`, so an upstream refresh that silently drops the
capability is caught the same way the other patches are.

---

## 2. Verify output

```
$ python .smoke/platform-patches.py verify
  ok      @deepseek-ai/dsh-session-format-v0-to-v1/lib/index.js
  ok      @deepseek-ai/dsh-api-settings-controller/lib/index.js
  ok      @deepseek-ai/dsh-api-session-controller/lib/index.js
  ok      @deepseek-ai/dsh-api-session-controller/lib/types/commands.js
  ok      @deepseek-ai/dsh-sandbox-local/lib/index.js
  ok      @deepseek-ai/dsh-web-frontend/dist/index.html

platform patches OK            (exit 0, 6 patches)
```

Store files are byte-identical copies of the edited vendor files (LF, no CRLF translation).

`git diff --no-index .tmp-vendor/stage-022rc2/node_modules/@deepseek-ai/<pkg> vendor/.../<pkg>`
shows exactly the intended files and nothing else:

| package | changed files |
|---|---|
| dsh-session-format-v0-to-v1 | `lib/index.js` only (+94/-1) |
| dsh-api-settings-controller | `lib/index.js` only (+14) |
| dsh-api-session-controller | `lib/index.js` (+9/-1), `lib/types/commands.js` (+9/-1) |
| dsh-sandbox-local | `lib/index.js` only (+7/-1) |
| dsh-web-frontend | `dist/index.html` only (+40) |
| dsh-session-persistence-jsonl | **identical to clean 0.2.2** (patch retired, no consumer) |
| dsh-subprocess-local | **identical to clean 0.2.2** (patch dropped) |
| dsh-win32-process | **identical to clean 0.2.2** (patch dropped) |
| dsh-client-ui-settings-models | **identical to clean 0.2.2** (patch dropped) |

---

## 3. Behavioural verification performed

### 3a. Session-format plugin tolerance (synthetic, real module)

Probe imports `assertReleasedPayloadSemantics` from the installed
`vendor/.../dsh-session-format-v0-to-v1/lib/index.js` (same export
`.smoke/session-history-check.mjs` uses) and feeds released-v0 payloads:

```
  ok   dshFileReview annotation dropped            (console: tolerated plugin-authored v0 data: dropped member "dshFileReview")
  ok   annotation removed from the validated in-memory event
  ok   snapshotId source member dropped            (… dropped member "snapshotId")
  ok   snapshotId removed from the validated in-memory event
  ok   non-notice summary dropped                  (… dropped "summary" on a plugin source whose form is "instructions")
  ok   summary removed from the validated in-memory event
  ok   missing required text still refuses         [content[0] lacks required member "text"]
  ok   tool/result with two blocks still refuses
  ok   plugin source missing required member still refuses
  ok   subagent/descriptor version 2 accepted natively
  ok   subagent/descriptor version 9 still refuses [version must be one of 1, 2, 3]
RESULT: PASS
```

### 3b. Embedded host boot + clipboard shim served (real 0.2.2 host)

Fresh throwaway `DSH_HOME`, profile `bundles=[dsh-base, dsh-web-app]`, same
`--expose-internals … --profile web --patch <overlay> --port 0 --no-open` launch as
`startHost()`, token→cookie exchange, then `GET /`:

```
  ok   host boots and prints the token URL
  ok   token exchange mints the auth cookie
  ok   GET / with the auth cookie is 200
  ok   the served SPA entry contains the clipboard shim
  ok   the shim is inside the shipped index.html (module entry still present)
RESULT: PASS
```

This also proves the patched modules (session-format, settings controller, api-session-controller,
sandbox-local) and the now-unpatched jsonl persistence all load under 0.2.2 at boot.

### 3c. `.smoke/embedded-open-settings-test.mjs` — PASS 10/10

```
embedded (DSH_EMBEDDED=1): ok no error / reports opened:true / emits the extension sentinel /
  on its own line / does NOT call the native opener
not embedded (DSH_EMBEDDED unset): ok no error / opened:true / calls the native opener once /
  emits no sentinel
RESULT: PASS
```

---

## 4. Tests that now legitimately fail on 0.2.2 (Lead-owned; NOT edited here)

These fail because 0.2.2 changed the module/file shape, not because a patch is missing. Exact
evidence and the change each needs:

1. **`.smoke/persistence-inspect-test.mjs` — 5/6 FAIL on 0.2.2; RETIRED, Lead deletes the test.**
   0.2.2's `dsh-session-persistence-jsonl` no longer exports the backend class:
   `import` yields only `['Config','JsonlCompressionSchema','apply','name']`, `default` is
   `undefined`, and the first export with a prototype is `schema` (a zod schema). The
   `JsonlSessionPersistence` class is defined at `lib/index.js:2403` but module-internal.
   No fix is needed now: the `inspect(id)` patch itself has no consumer in this build (see §1 row 4),
   so the patch, the store entry and this test were retired together. (Recorded here only so a future
   re-introduction knows the module shape cannot be probed via exports.)

2. **`.smoke/windows-hide-test.mjs` — crashes ENOENT (does not reach its checks).**
   It reads `vendor/.../dsh-subprocess-local/lib/runner-launch-COYGu0Dl.js`; 0.2.2 ships
   `lib/runner-launch-CKTiL8M8.js` (the fallback `spawnSubprocess` with
   `windowsHide: platform === "win32"` is at `:1053` there).
   *Needed:* update `FALLBACK_FILE` to the new chunk name (or glob `runner-launch-*.js` and pick the
   file containing `function spawnSubprocess`).

3. **`.smoke/session-history-check.mjs` — reports "31 sessions, 0 rows validated, PASS" (vacuous).**
   It looks for `session.jsonl.zstd`; 0.2.2 names session logs `session.v<N>.jsonl.zstd`
   (real home: 31 × `session.v4.jsonl.zstd`, 27 × `session.v3.jsonl.zstd`, zero
   `session.jsonl.zstd`). Also the script feeds every row to the **v0** semantics; v3/v4 rows must
   not be measured by the v0 validator.
   *Needed:* glob `session.*.jsonl.zstd`, parse the format version from the filename, and only run
   `assertReleasedPayloadSemantics(…, 0)` for `v0` files (the v0→v1 plugin-tolerance patch is only
   about v0 history; the machine's old v0 logs were already migrated by the 0.1.5 host, so there is
   no local v0 corpus left to exercise it — hence the synthetic probe in §3a).

4. **`.smoke/boot-test.mjs` — host exits code 1 (not caused by platform patches).**
   `dsh-mnemon` fails with `TypeError: ctx.settings.register is not a function`
   (`dsh-mnemon/lib/index.js:8265`), plus 11 plugins wait on services (e.g. `better-sidebar` →
   `webRuntime`). That is the bundled-plugin API port to 0.2.2, a separate task.
   Additionally the harness's `BUNDLED_PLUGINS` regex harvests double-quoted strings **from
   comments** inside the array, so it reports phantom entries
   `"The registry neither scans directories nor accepts preset paths"` and `"@dsh-vscode/presets"`
   and the host logs a "cannot resolve profile bundle" skip for the phrase.
   *Needed (test bug):* strip `//` comments before extracting quoted names.

---

## 5. Assumptions / items for the Lead

- **`CREATE_NO_WINDOW` on the ordinary Win32 path is not re-ported** (see #5). Upstream now hides the
  same creation with `STARTF_USESHOWWINDOW`+`SW_HIDE`; the visible-window defect is fixed. If a
  future run shows a flash on the ordinary (non-sandbox) path, re-adding
  `CURRENT_TOKEN_JOB_CREATION_FLAGS = 0x400 | 0x4 | 0x8000000` at
  `dsh-win32-process/lib/index.js:712` is the known remedy (it was safe there; the risk is only on
  the restricted-token sites, which stay untouched).
- **Persistence `inspect()` patch: RETIRED** (Lead decision, accepted rationale). Its consumer
  (`@dsh-undo/*`) was removed in commit `9a7bf80c`; `@mlgbnb/dsh-archive-manager` reads
  `session.jsonl.zstd` with its own decoder and better-sidebar uses `open(id,'read')`, so nothing
  calls `sessionPersistence.inspect`. The vendor file was reverted byte-identical to clean 0.2.2,
  the store/manifest entry removed, and `.smoke/persistence-inspect-test.mjs` is deleted by the Lead
  (a dead seam would otherwise be re-derivation cost on every upgrade).
- **Model-capability UI**: dropped as superseded (§1). Only the "persist immediately" UX differs.
- The manifest `_comment` records the two dropped 0.1.5 patches, the retired persistence patch and
  the superseded UI edit so a future `apply`/review cannot silently reintroduce them.
