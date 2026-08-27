# DeepSeek Harness (DSH) for VS Code

Run the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **native web surface** inside a VS Code webview. All host dependencies are bundled into the extension — the user machine needs **no Node.js, no npm, no pnpm, no Python**. VS Code itself provides the runtime.

## How it works (Method B)

1. On open, the extension forks the bundled DSH host as a child process from the extension host:
   `dsh --profile web --port 0 --no-open`
   (`ELECTRON_RUN_AS_NODE=1` makes the VS Code binary serve as the Node runtime, so no standalone Node is required.)
2. The host binds `127.0.0.1` on an OS-assigned port and serves the prebuilt web UI (`@deepseek-ai/dsh-web-frontend/dist`).
3. A webview panel shows a local HTML shell containing a full-viewport iframe pointing at `http://127.0.0.1:<port>/`.
4. The panel declares VS Code's stable `WebviewPortMapping` (`{ webviewPort: port, extensionHostPort: port }`). The webview service worker intercepts the iframe navigation and every subresource/`/api` request and proxies them through the extension host.
5. Because the DSH `/api` trust fence sees those requests as clean loopback requests from the extension host (no `Origin`/`Sec-Fetch-Site` browser markers), it passes **without any modification to DSH**. The DSH web client uses fetch + SSE only (no WebSocket), which the port-mapping proxy supports.

### Verified facts (smoke-tested on this machine)

- Host boots from the npm-installed tree: `dsh --profile web --port 0 --no-open` prints `dsh web: http://127.0.0.1:<port>`.
- The served `index.html` contains the boot injection plus `/plugins/@deepseek-ai/<pkg>/client.js` scripts and `/assets/*` bundles — all same-origin paths inside the iframe.
- Trust fence behavior: a request carrying `Origin: http://evil.example` + `Sec-Fetch-Site: cross-site` → **403**; the same request with no browser markers (what the VS Code localhost proxy produces) → **200**. This is exactly why Method B needs no DSH code changes.
- VS Code 1.133 ships `WebviewPortMapping` as a **stable** API (verified in `resources/app/out/vscode-dts/vscode.d.ts`, no proposed variant).

## Building the .vsix (developer machine only)

Both heavyweight inputs are **committed to this repository** so a fresh clone can reproduce the .vsix without a network install:

- `vendor/` — the vendored DSH platform tree (MIT) the host runs from. Rebuild it from the flat install with `pnpm install --node-linker=hoisted && rm -rf vendor && cp -r node_modules vendor` (then re-apply the trims documented in `.smoke/`).
- `plugins/bundled/` — the self-contained baked plugin set embedded in the extension. Re-assembling it from `plugins/node_modules` is covered by `plugins/_selfcontained.mjs` (it drops native-ABI packages like ssh2/lightningcss and flattens non-platform host deps into `_hostdeps/`).

The packaging chain is deterministic and matches the shipped artifact:

```bash
# 1. assemble the vsix (standard zip + vsix manifest, excludes *.map)
python .smoke/pack.py
# -> dsh-vscode.vsix
```

Users never touch npm: install the .vsix via *Extensions → ⋯ → Install from VSIX...*.

> The `.smoke/pack.py` route is preferred over `npx @vscode/vsce package` — vsce's dependency listing rejects pnpm layouts and its file walk is much slower.

## Bundled ecosystem plugins

The extension ships these third-party ecosystem plugins under `plugins/bundled` (each keeps its own LICENSE):

| Plugin | Origin | Local changes |
|---|---|---|
| `dsh-recall-plugin` | [limbo947/dsh-recall-plugin](https://github.com/limbo947/dsh-recall-plugin) | Recall confirm dialog adds a **rollback scope choice**: full rollback (chat + files) or chat-only rollback |
| `dsh-memory-evolve` | [csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) | None (package trimmed to `lib` + `vendor` + `skills`) |
| `dsh-better-sidebar` | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | None |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | None |
| `@linxin666/dsh-*` (chat-recovery, desktop-launcher, doctor, liangshen, pet, UI panels, …) | [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) repo / linxin666 ecosystem | None; `dsh-ssh` and `dsh-client-ui-skin-center` are **excluded** (native ABI cannot load in the VS Code embedded Node) |
| `dsh-miraculous-standard`, `@dsh-external/dsh-super-injector` | community packages | None |
| `_hostdeps/` (cosmokit, fflate, jpeg-js, schemastery) | npm packages | Vendored so non-platform host deps resolve offline |

## Commands

| Command | Action |
|---|---|
| `DSH: Open` | Open the Harness panel (starts the host if needed) |
| `DSH: Restart Host` | Kill and restart the host, recreate the panel |
| `DSH: Open in External Browser` | Escape hatch: open the same host URL in the system browser |
| `DSH: Show Host Logs` | Output channel with host stdout/stderr |

## Settings

- `dsh.openOnStartup` — open the panel automatically (trusted workspaces only).
- `dsh.cwd` — the host's working directory (= the agent's cwd). Empty = first workspace folder.
- `dsh.dshHome` — override `DSH_HOME` (profiles, settings, sessions). Empty = DSH default.

## Smoke-test checklist (after installing the .vsix)

1. Panel opens and the DSH UI renders (boot injection + `/plugins/*/client.js` + `/assets/*` load through the port mapping).
2. **SSE event streaming** reaches the UI live (long-lived `/api/events.*` stream through the proxy).
3. `run_code`/tool execution, image attachments, and settings persistence.
4. Host crash → error page → *Restart host* works.
5. Second VS Code window gets its own host instance on its own port.

## Known considerations

- `engines.vscode: ^1.133.0` — the floor where `WebviewPortMapping` was verified stable here. Lower it only after testing on that version.
- The extension deliberately declares `untrustedWorkspaces.supported: false` (the host can run commands and read/write files).
- Marketplace publication requires disclosure of the loopback server + command execution (same class as Cline/Continue).
- One host per VS Code window (one extension host per window); `--port 0` makes them conflict-free.
- The .vsix is large (~100–200 MB) because the full runtime tree ships inside. Pruning candidates (later): platform prebuilds for other OSes, `@vscode/vsce` remnants, unused tool backends.
