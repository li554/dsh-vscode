# dsh-rollback-withdraw

**Trae-style withdraw for DeepSeek Harness Web.** A one-click rollback button on every user question and assistant answer that rewinds both the **workspace code** and the **conversation itself** (memory, trajectory, goals) to the state before that message.

[简体中文](./README.zh-CN.md) · [English](./README.md)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)

---

## What it does

Every completed turn in a DSH web session becomes a *rollback point*. Click the undo icon next to any message and the workspace files are restored to the last completed turn before it, while the session is forked at that point and the rolled-back conversation opens automatically — exactly as if that exchange never happened.

- **Workspace code** — restored via the best available backend (see below).
- **Conversation** — the session is forked at the boundary and the child (rolled-back) session is opened; model memory, trajectory, goals and subagent lineage all match that point in time.
- **First-class git integration** — when the workspace is a git repository, checkpoints are real commits, and a withdraw is a `git reset --hard` + a safe `git clean`.

## Features

- **Withdraw on every message** — under every user bubble and on the final assistant message of each completed turn.
- **Two restore backends, chosen automatically:**
  - **Git mode** (default on, one-click toggle): every turn end is committed as `rollback checkpoint <seq>`; a withdraw restores via `git reset --hard` + `git clean` that preserves dependency/build directories. Space-efficient and aligned with normal git workflows.
  - **File-snapshot mode**: otherwise, hard-link snapshots are taken at every turn end — unchanged files share a single copy across snapshots, so keeping hundreds of turns costs almost nothing.
- **Per-workspace toggle** — the git-branch icon in the session header turns git auto-commit on/off; the choice persists in `.dsh-rollback/config.json`.
- **Loads automatically** — packaged as a web-profile bundle (`dsh.bundle` + `dsh.client`), it starts with the client; no re-activation after restarts.
- **Two-step confirm** — click once to arm (button turns red), click again to execute, so a rollback is never accidental.

## Requirements

| Item | Notes |
| --- | --- |
| OS | Windows (uses `robocopy` + PowerShell 5.1+); other platforms planned |
| Git | optional — only needed for git mode |
| DSH | web profile (`dsh web`) |

## Installation

```bash
# from npm
dsh plugin --profile web add dsh-rollback-withdraw

# or from this repository
dsh plugin --profile web add github:dyhyfjn/dsh-rollback-withdraw

# or a local build
npm pack && dsh plugin --profile web add ./dsh-rollback-withdraw-0.1.0.tgz
```

Restart the web app afterwards — plugin-set changes take effect on restart.

## Usage

1. Chat with the agent as usual; a rollback point is recorded automatically after every completed turn.
2. Hover a message and click the **undo icon** — click once to arm ("confirm"), click again to execute.
3. The workspace is restored and the UI switches to the forked, rolled-back session. Continue from there.

The **git-branch icon** in the session header shows git-mode status:

- lit (brand color + green dot) = git auto-commit **on**;
- dimmed = **off**, or the workspace is not a git repository (tooltip explains);
- disabled when the workspace has no git repo.

## How it works

- The host half listens to `session/event` and records a checkpoint at every `turn/end` — a git commit, or a hard-link snapshot under `<workspace>/.dsh-rollback/snap/<session>/<seq>/`.
- Client buttons talk to the host through a same-origin HTTP route `/rollback/rpc` (the static-plugin channel that replaces the dynamic `harness.handle`).
- A withdraw validates the boundary (the last `turn/end` before the message), restores the files, then the client forks the session at that sequence and opens the child.
- The first message of a session cannot be withdrawn (there is no prior turn); messages from before the plugin was installed have no snapshot — the button explains why.

## Configuration

| Key | Where | Default | Meaning |
| --- | --- | --- | --- |
| `gitAutoCommit` | `<workspace>/.dsh-rollback/config.json` | `true` | use git commits as rollback points when the workspace is a git repo |

Ignored paths (never snapshotted, committed, or deleted): `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `__pycache__`, `.idea`, `.vscode`, `coverage`, `*.pyc`, `*.log`, … (see `IGNORE_DIRS` / `IGNORE_FILES` in `lib/index.js`).

## Security note

`/rollback/rpc` is a same-origin, unauthenticated route on the localhost web server — this tool assumes personal, localhost-only usage. Do not expose the harness port to untrusted networks.

## Limitations

- Windows first (robocopy + PowerShell); macOS/Linux fallbacks are planned.
- Git mode performs a whole-repository `git reset --hard` + `git clean` (ignored directories preserved) — untracked non-ignored files are deleted on rollback.
- Withdrawing an assistant answer also rewinds the preceding question (rollback returns to the last completed turn end); the platform's fork primitive only cuts at turn boundaries.
- The source session stays in the sidebar as a branch; there is no auto-archive.

## Development

```bash
npm pack                 # produce the publishable tarball
node --check lib/index.js lib/client.js   # syntax gate
```

## License

MIT — see [LICENSE](./LICENSE).
