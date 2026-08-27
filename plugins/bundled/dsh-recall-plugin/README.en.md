# dsh-recall-plugin

> Recall a message, and your project files go back with it.

[简体中文](README.md) | English

![npm](https://img.shields.io/npm/v/dsh-recall-plugin?label=npm&color=cb3837)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)
![DSH](https://img.shields.io/badge/DSH-0.1.0--rc-blue)
![Build](https://img.shields.io/badge/pure%20JS-zero%20build-green)

---
**Under any message you've sent**, **click "↶ Recall"**, **and both your workspace files and the conversation history roll back to the moment right before that message was sent**.

## UI Preview
- Recall button location

![Recall button appears on hover](docs/screenshots/recall-button.png)

---
| Confirmation panel · file change list | Confirmation panel · rollback scope |
| --- | --- |
| ![Confirmation panel · file change list](docs/screenshots/confirm-panel-1.png) | ![Confirmation panel · rollback scope](docs/screenshots/confirm-panel-2.png) |

- After a recall, the message text is auto-refilled into the input box for quick editing and resending (can be disabled in the settings card)
- Settings · plugin config card (thresholds / exclusions / snapshot manager, saved changes apply live)

| Settings | Settings |
| --- | --- |
| ![Settings·editing](docs/screenshots/settings-exclude-1.png) | ![Settings·saved](docs/screenshots/settings-exclude-2.png) |

- Settings page · Snapshot Manager (tree: workspace → session → snapshot, leaves show message content)

> Tree-view snapshot manager screenshot to be added later (the feature is already implemented in the current version).

## Highlights

- **Files + conversation, rolled back together**: recalling isn't just about chat history — files the agent modified go back to their original state too.
- **Never touches your project's own git**: snapshots live in an independent shadow git repository; your branches, staging area, and uncommitted changes are untouched. `.git` and `node_modules` are excluded automatically.
- **Keeps your project directory clean**: snapshots always live under `$DSH_HOME`, nothing is ever dropped into your project — regardless of the session's sandbox permission (workspace-write / read-only sessions snapshot and recall as usual). Only when home itself is unwritable (e.g. pointed at a read-only drive) does it fall back to an in-project `.dsh-recall-snapshots` directory (the page shows a notice when degraded); once home is writable again, data migrates back and the fallback directory is cleaned up.
- **Change your mind as many times as you like**: as long as the session still exists (including archived ones), snapshots are fully retained and never pruned. After one recall you can recall again to an even earlier point; files overwritten during a recall always remain recoverable. Once a session is permanently deleted, its snapshots are cleaned up accordingly (see below).
- **See the list before you act**: clicking recall first shows the list of files that will change (modified / restored / deleted); nothing is overwritten until you confirm.
- **Disk-friendly**: snapshots use git delta compression — incremental, not full-directory copies. Files larger than 100MB are skipped automatically (the threshold is configurable in the settings card).
- **Automatic housekeeping**: periodic `git gc` packs loose objects (lossless — not a single snapshot is lost); snapshots of deleted sessions are cleaned up automatically; build artifacts can be excluded globally via `exclude.txt` (see below).
- **Failures speak up** (1.7.0+): snapshot failures, skipped paths, and circuit-breaker pauses all surface as a toast at the top of the page (the same fault only bothers you once per 10 minutes) — nothing fails silently; the failure reason lands in the "Recent errors" section of the settings card.
- **Self-healing on failure** (1.7.0+): after a snapshot fails, leftover objects are pruned automatically; 3 consecutive failures trigger an exponential-backoff circuit breaker (auto-retry after the cooldown); the failure path also sweeps stray git processes and stale locks — the disk never bloats from failed retries, and a single hiccup can't wedge the pipeline.
- **Unindexable paths are skipped, not fatal** (1.7.0+): embedded git repositories, unreadable files, and other paths that can't be indexed no longer fail the whole snapshot — the snapshot is still taken, and skipped paths are reported via toast (on recall they are neither restored nor deleted, same semantics as exclusions).
- **Tree-view snapshot manager**: the "Snapshot Manager" on the settings page shows a **workspace → session → snapshot** three-level tree with expand/collapse support; each level has a delete button on its right, so you can clear all snapshots of a workspace or a session at once. Leaves show a summary of the message content the snapshot corresponds to, making it easy to locate "what this message changed back then".

## Known Limitations

- Snapshots are created **when a message is sent**; messages from before the plugin was enabled have no snapshot and show no recall button.
- The first user message of a session cannot roll back the conversation (files only), because fork requires an earlier turn boundary.
- Supports Windows (PowerShell 5.1/7 + git CLI) and Linux/macOS (bash + git CLI). Windows is thoroughly verified on real machines; Linux has been fully tested on WSL2 (Ubuntu 26.04, bash 5.3 + git 2.53), including Chinese paths, home fallback, session cleanup, and gc; the macOS side is written to be bash 3.2 compatible but has not been tested on real hardware yet.
- Nested git repositories inside the workspace (subdirectories with their own `.git`) cannot be indexed: the snapshot proceeds for everything else (fail-open, with a toast listing the skipped paths), but their contents do not participate in recalls.
- Extreme cases like filenames containing newlines/TAB are beyond the diff list's parsing capability (negligible probability).

## Installation

Prerequisites: git CLI (without it the recall button won't appear and a notice shows at the top of the page — DSH itself keeps running); PowerShell 5.1 / 7 on Windows, bash + git on Linux/macOS; DSH 0.1.0-rc.x (see `peerDependencies` for dependency versions).

- Official DSH plugin command: install and auto-mount into the web profile
```powershell
dsh plugin --profile web add dsh-recall-plugin
```
- Or install directly from git (pure JS, no build step, no prepare/allowBuilds needed):
```powershell
dsh plugin --profile web add github:limbo947/dsh-recall-plugin
```
- Restart the DSH process (pick whichever matches how you start it)
```powershell
dsh web                      # run in the foreground
pm2 restart <your-dsh-name>  # if managed by pm2
```

**Verify**: after restarting, hard-refresh the page (Ctrl+Shift+R) and hover over any user message sent after the plugin was enabled — the "↶" appearing next to the copy button means it works. No button? Nine times out of ten the DSH process wasn't restarted, or git CLI isn't on PATH.

**Uninstall**: `dsh plugin --profile web remove dsh-recall-plugin` (removes both the dependency and the mount layer). Snapshot data is kept under `dsh-recall-snapshots/` in home; delete that directory manually if you want it fully gone.

## Usage

1. Hover over any user message sent **after the plugin was enabled** — "↶ Recall" appears to the left of the copy button.
2. Click it → the confirmation panel shows the list of files that will change (modified / restored / deleted).
3. Click "Confirm rollback" → files are restored to their state before that message was sent; the view switches to a new session (that message and everything after it is removed), while the original session is archived and can be recovered anytime.

## Snapshot Maintenance & Cleanup

Snapshots are fully retained as long as "the session might still be recoverable"; on top of that, the plugin manages disk usage automatically — no manual housekeeping needed:

- **Periodic gc**: every 50 snapshots or 24 hours since the last gc (whichever comes first), `git gc` runs in the background to pack loose objects. This is lossless — every snapshot remains recallable. The throttle token lives in `gc.stamp` inside the shadow repository, so restarting DSH does not reset the cycle. Both thresholds can be overridden via environment variables (rarely needed): `DSH_RECALL_GC_SNAPS`, `DSH_RECALL_GC_HOURS`.
- **Session-deletion cleanup**: once a session is permanently deleted (its log gone from disk), the next maintenance pass automatically removes all of its snapshots and frees the space. **Archiving is not deletion** — logs of sessions archived by the recall feature itself still exist, so their snapshots are kept and recoverable from the archive. The check is conservative: a session that is merely cold (not in memory) is never cleaned, and when the log's state cannot be verified, it is left alone.
- **User-defined exclusions**: open "**Settings → Plugins → Recall Plugin** card (collapsed by default; click the header to expand)" to edit snapshot exclusions visually — type a path or pattern and press Enter to add it, one-click append for common patterns (`dist/`, `*.log`, `.env`, …), and saved changes take effect on the very next snapshot/recall, no restart needed. Alternatively, edit `dsh-recall-snapshots/exclude.txt` under home directly (i.e. `$DSH_HOME/dsh-recall-snapshots/exclude.txt`, or `~/.dsh/dsh-recall-snapshots/exclude.txt` when unset; UTF-8; one gitignore-style pattern per line; lines starting with `#` are comments) — both paths edit the same configuration, for example:

  ```gitignore
  # keep build artifacts out of snapshots
  dist/
  build/
  *.log
  ```

  This applies to all projects (when home is unwritable and a workspace falls back to in-project storage, it gets its own independent exclusion config, listed as a separate card in the settings tab). New exclusions only affect future snapshots; **when recalling to an earlier snapshot, files that weren't excluded at that time are still restored** (returning to the state as it was — that's exactly what recall means). To fully purge a directory that already made it into snapshots, manually delete the corresponding hash directory under `dsh-recall-snapshots/` in home. The settings card requires DSH's built-in settings page (all 0.1.0-rc.x releases have it); on very old versions without the tab, editing the file directly is equivalent.
- **Tree-view snapshot manager**: open "**Settings → Plugins → Recall Plugin → Snapshot Manager**" to see the tree list — first level workspace (folder name), second level session (session title), third level snapshot (time + message content summary, hover to see the full content). Workspace and session nodes support expand/collapse; every level has a delete button on its right, with an inline confirmation before deletion. Deleting a workspace = clearing all snapshots of that workspace; deleting a session = clearing all snapshots of that session within that workspace; deleting a leaf = removing just that single snapshot.

## How It Works

When each user message is sent (before the agent touches any files), the workspace is snapshotted into an independent shadow git repository; on recall, files are restored via `git archive` and the conversation is rewound through DSH's official `sessions.fork` mechanism. Binary-safe, and your project's own git state is never touched.

- Snapshot storage: `dsh-recall-snapshots/<SHA256(project absolute path)>/` under home, containing the shadow git repository (`git/`, tags named `snap-<messageID>`) and the index file `index.json` (message ID → snapshot time / session). Scripts run via PowerShell on Windows and bash on Linux/macOS (forked automatically by the executor mounted on the `ctx.shell` platform layer).
- To browse historical snapshots directly:

  ```powershell
  git --git-dir="<store>\git\.git" tag -l
  git --git-dir="<store>\git\.git" ls-tree -r --name-only snap-<messageID>
  ```

## Local Development (without publishing)

Point the profile's dependency for this package at your clone via `link:`, and changes take effect after restarting DSH (the workspace `lib/` IS the running code — no copying or publishing needed):

```powershell
# 1. Edit $env:USERPROFILE\.dsh\profiles\web\package.json:
#    in "dependencies", set "dsh-recall-plugin": "link:<path-to-your-clone>\dsh-recall-plugin"
#    "dsh.profile.bundles" should already contain "dsh-recall-plugin" (run the official install command once)
# 2. Install in the profile directory and restart
cd $env:USERPROFILE\.dsh\profiles\web
pnpm install
# 3. Restart DSH and hard-refresh the page (Ctrl+Shift+R)
```


## License

MIT

---

[Changelog](CHANGELOG.md)
