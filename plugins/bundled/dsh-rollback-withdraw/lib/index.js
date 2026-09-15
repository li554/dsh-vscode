import { Buffer } from "node:buffer"

// Trae-style withdraw for the DSH web app (static host half).
// - Records a rollback point at every completed turn: git commit (when the
//   workspace is a git repo and the per-workspace toggle is on) or a
//   hard-link file snapshot.
// - Client buttons call this half through the HTTP route /rollback/rpc
//   (method + JSON args), which validates the message boundary, restores the
//   workspace (git reset+clean or robocopy /MIR mirror), and returns the
//   fork boundary the client uses to fork+open the rolled-back session.
export default {
  name: "rollback-withdraw",
  inject: ["sessions", "fs", "subprocess", "sandboxPolicy", "webServer"],
  apply(ctx) {
    const sessions = ctx.get("sessions")
    const fs = ctx.get("fs")
    const subprocess = ctx.get("subprocess")
    const sandboxPolicy = ctx.get("sandboxPolicy")
    const webServer = ctx.get("webServer")
    if (sessions === undefined || fs === undefined || subprocess === undefined || webServer === undefined) return

    const IGNORE_DIRS = [".dsh-rollback", ".git", "node_modules", "dist", "build", "out", ".next", ".nuxt", ".output", ".cache", ".turbo", ".venv", "venv", "env", "__pycache__", ".idea", ".vscode", ".vs", "target", ".gradle", ".pytest_cache", ".mypy_cache", ".tox", ".nox", "coverage"]
    const IGNORE_FILES = [".DS_Store", "*.pyc", "*.log"]
    const COMMON = ["/XD", ...IGNORE_DIRS, "/XF", ...IGNORE_FILES, "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"]
    const MIRROR_ARGS = ["/MIR", ...COMMON]

    const SNAPSHOT_SCRIPT = String.raw`param(
  [string]$Src,
  [string]$Prev,
  [string]$New,
  [string]$IgnoreDirs = '',
  [string]$IgnoreFiles = ''
)
$ErrorActionPreference = 'Stop'
$script:ignoreDirNames = @($IgnoreDirs -split ',' | Where-Object { $_ -ne '' } | ForEach-Object { $_.Trim() })
$script:ignoreFilePatterns = @($IgnoreFiles -split ',' | Where-Object { $_ -ne '' } | ForEach-Object { $_.Trim() })
$script:prevRoot = $null
if ($Prev -ne '' -and (Test-Path -LiteralPath $Prev)) { $script:prevRoot = (Resolve-Path -LiteralPath $Prev).Path }
if (-not (Test-Path -LiteralPath $New)) { New-Item -ItemType Directory -Path $New -Force | Out-Null }

function Should-IgnoreDir([string]$name) {
  foreach ($n in $script:ignoreDirNames) { if ($name -ieq $n) { return $true } }
  return $false
}
function Should-IgnoreFile([string]$name) {
  foreach ($p in $script:ignoreFilePatterns) { if ($name -ilike $p) { return $true } }
  return $false
}

function Copy-Tree([string]$from, [string]$to, [string]$rel) {
  foreach ($child in Get-ChildItem -LiteralPath $from -Force) {
    if ($child.PSIsContainer) {
      if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
      if (Should-IgnoreDir $child.Name) { continue }
      $childRel = ''
      if ($rel -ne '') { $childRel = $rel + '\' + $child.Name } else { $childRel = $child.Name }
      $sub = Join-Path $to $child.Name
      New-Item -ItemType Directory -Path $sub -Force | Out-Null
      Copy-Tree $child.FullName $sub $childRel
    } else {
      if (Should-IgnoreFile $child.Name) { continue }
      $target = Join-Path $to $child.Name
      if ($script:prevRoot) {
        $fileRel = ''
        if ($rel -ne '') { $fileRel = $rel + '\' + $child.Name } else { $fileRel = $child.Name }
        $prevFile = Join-Path $script:prevRoot $fileRel
        if (Test-Path -LiteralPath $prevFile) {
          $pfi = Get-Item -LiteralPath $prevFile
          if ($pfi.Length -eq $child.Length -and $pfi.LastWriteTimeUtc -eq $child.LastWriteTimeUtc) {
            New-Item -ItemType HardLink -Path $target -Target $prevFile | Out-Null
            continue
          }
        }
      }
      Copy-Item -LiteralPath $child.FullName -Destination $target
      [IO.File]::SetLastWriteTimeUtc($target, $child.LastWriteTimeUtc)
    }
  }
}
Copy-Tree $Src $New ''
`

    function joinPath() {
      return Array.prototype.join.call(arguments, "/").replace(/\\/g, "/")
    }

    let policy
    try {
      policy = sandboxPolicy !== undefined ? sandboxPolicy.resolve({ mode: "danger-full-access" }) : undefined
    } catch (e) {
      policy = undefined
    }

    let robocopyProbe = null
    function robocopy() {
      robocopyProbe ||= subprocess.resolveExecutable("robocopy").then((exe) => exe).catch(() => null)
      return robocopyProbe
    }

    let shellProbe = null
    function shell() {
      shellProbe ||= (async () => {
        for (const name of ["pwsh", "powershell"]) {
          try {
            const exe = await subprocess.resolveExecutable(name)
            if (exe) return exe
          } catch (e) { /* try next */ }
        }
        try {
          return await subprocess.resolveExecutable("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
        } catch (e) {
          return null
        }
      })()
      return shellProbe
    }

    let gitProbe = null
    function git() {
      gitProbe ||= subprocess.resolveExecutable("git").then((exe) => exe).catch(() => null)
      return gitProbe
    }

    async function spawnOk(argv, cwd) {
      const handle = subprocess.spawn({
        argv,
        cwd,
        stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
        graceMs: 60000
      })
      const outcome = await handle.done
      return outcome.exitCode !== null && outcome.exitCode === 0
    }

    async function spawnCollect(argv, cwd) {
      const handle = subprocess.spawn({
        argv,
        cwd,
        stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
        graceMs: 60000
      })
      const outcome = await handle.done
      let stdout = ""
      try {
        if (handle.collected && handle.collected.stdout) stdout = handle.collected.stdout.readFrom(0).text
      } catch (e) { /* ignore */ }
      return { exitCode: outcome.exitCode, stdout }
    }

    async function runRobocopy(argv, cwd) {
      const exe = await robocopy()
      if (!exe) throw new Error("robocopy unavailable")
      const handle = subprocess.spawn({
        argv: [exe, ...argv],
        cwd,
        stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
        graceMs: 60000
      })
      const outcome = await handle.done
      if (outcome.exitCode === null || outcome.exitCode >= 8) {
        throw new Error("robocopy failed (exit " + String(outcome.exitCode) + ")")
      }
    }

    async function workspaceOf(session) {
      const cwd = session.header && session.header.cwd
      if (typeof cwd !== "string" || cwd === "") return null
      try {
        const target = await fs.resolve(cwd)
        const info = await fs.stat(target)
        if (!info || info.type !== "directory") return null
        return { cwd, path: fs.processPath(target) }
      } catch (e) {
        return null
      }
    }

    function snapRoot(wsPath, sessionId) {
      return joinPath(wsPath, ".dsh-rollback", "snap", sessionId)
    }

    function checkpointDir(wsPath, sessionId, boundarySeq) {
      return joinPath(snapRoot(wsPath, sessionId), String(boundarySeq))
    }

    async function writeManifest(wsPath, sessionId, boundarySeq, cwd, gitCommit) {
      const payload = { sessionId, boundarySeq, time: Date.now(), cwd }
      if (gitCommit) payload.gitCommit = gitCommit
      const target = await fs.resolve(joinPath(checkpointDir(wsPath, sessionId, boundarySeq), "manifest.json"))
      await fs.writeText(target, JSON.stringify(payload), undefined, undefined, policy)
    }

    async function readManifest(wsPath, sessionId, boundarySeq) {
      try {
        const target = await fs.resolve(joinPath(checkpointDir(wsPath, sessionId, boundarySeq), "manifest.json"))
        const text = await fs.readText(target)
        return JSON.parse(text)
      } catch (e) {
        return null
      }
    }

    async function readConfig(wsPath) {
      try {
        const target = await fs.resolve(joinPath(wsPath, ".dsh-rollback", "config.json"))
        const info = await fs.stat(target)
        if (info === undefined) return { gitAutoCommit: true }
        const text = await fs.readText(target)
        const parsed = JSON.parse(text)
        return { gitAutoCommit: parsed.gitAutoCommit !== false }
      } catch (e) {
        return { gitAutoCommit: true }
      }
    }

    async function writeConfig(wsPath, cfg) {
      const target = await fs.resolve(joinPath(wsPath, ".dsh-rollback", "config.json"))
      await fs.writeText(target, JSON.stringify(cfg), undefined, undefined, policy)
    }

    async function inGitRepo(wsPath) {
      const exe = await git()
      if (!exe) return false
      try {
        const r = await spawnCollect([exe, "rev-parse", "--is-inside-work-tree"], wsPath)
        return r.exitCode === 0
      } catch (e) {
        return false
      }
    }

    const gitLocks = new Map()
    async function gitCommitSnapshot(wsPath, seq) {
      const exe = await git()
      if (!exe) return null
      try {
        const top = await spawnCollect([exe, "rev-parse", "--show-toplevel"], wsPath)
        if (top.exitCode !== 0) return null
        const lockKey = "git:" + (top.stdout.trim() || wsPath)
        const prev = gitLocks.get(lockKey) || Promise.resolve()
        const run = prev.catch(() => {}).then(async () => {
          const addArgs = ["add", "-A", "--", ".", ":(exclude).dsh-rollback", ...IGNORE_DIRS.map((d) => ":(exclude)" + d)]
          await spawnCollect([exe, ...addArgs], wsPath)
          await spawnCollect([
            exe, "-c", "user.name=dsh-rollback", "-c", "user.email=rollback@dsh.local",
            "commit", "-m", "rollback checkpoint " + String(seq)
          ], wsPath)
          const head = await spawnCollect([exe, "rev-parse", "HEAD"], wsPath)
          if (head.exitCode !== 0 || !head.stdout.trim()) return null
          return head.stdout.trim()
        })
        gitLocks.set(lockKey, run.catch(() => {}))
        return await run
      } catch (e) {
        console.error("[rlbk] git commit failed", String((e && e.message) || e))
        return null
      }
    }

    async function gitRestore(wsPath, commit) {
      const exe = await git()
      if (!exe) return false
      try {
        const reset = await spawnCollect([exe, "reset", "--hard", commit], wsPath)
        if (reset.exitCode !== 0) return false
        const cleanArgs = ["clean", "-fdx"]
        for (const d of IGNORE_DIRS) cleanArgs.push("-e", d)
        const clean = await spawnCollect([exe, ...cleanArgs], wsPath)
        return clean.exitCode === 0
      } catch (e) {
        console.error("[rlbk] git restore failed", String((e && e.message) || e))
        return false
      }
    }

    const writtenScripts = new Set()
    async function ensureSnapshotScript(wsPath) {
      if (writtenScripts.has(wsPath)) return true
      try {
        const target = await fs.resolve(joinPath(wsPath, ".dsh-rollback", "scripts", "snapshot.ps1"))
        const info = await fs.stat(target)
        if (info === undefined) {
          await fs.writeText(target, SNAPSHOT_SCRIPT, undefined, undefined, policy)
        }
        writtenScripts.add(wsPath)
        return true
      } catch (e) {
        console.error("[rlbk] snapshot script write failed", String((e && e.message) || e))
        return false
      }
    }

    async function listCheckpointDirs(wsPath, sessionId) {
      const out = []
      try {
        const rootTarget = await fs.resolve(snapRoot(wsPath, sessionId))
        const entries = await fs.listDir(rootTarget)
        for (const entry of entries) {
          if (entry.type !== "directory") continue
          const bs = Number(entry.name)
          if (Number.isInteger(bs) && bs >= 0) out.push(bs)
        }
      } catch (e) { /* snap root does not exist yet */ }
      out.sort((a, b) => a - b)
      return out
    }

    async function recordFileSnapshot(session, boundarySeq, ws) {
      const treeDir = joinPath(checkpointDir(ws.path, session.id, boundarySeq), "tree")
      const exe = await shell()
      if (exe !== null && (await ensureSnapshotScript(ws.path))) {
        const dirs = await listCheckpointDirs(ws.path, session.id)
        let prev = -1
        for (const d of dirs) if (d < boundarySeq && d > prev) prev = d
        const prevTree = prev < 0
          ? joinPath(ws.path, ".dsh-rollback", ".no-prev")
          : joinPath(checkpointDir(ws.path, session.id, prev), "tree")
        const scriptPath = joinPath(ws.path, ".dsh-rollback", "scripts", "snapshot.ps1")
        const ok = await spawnOk([
          exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
          "-Src", ws.path, "-Prev", prevTree, "-New", treeDir,
          "-IgnoreDirs", IGNORE_DIRS.join(","), "-IgnoreFiles", IGNORE_FILES.join(",")
        ], ws.path)
        if (ok) {
          await writeManifest(ws.path, session.id, boundarySeq, ws.cwd)
          return
        }
        console.error("[rlbk] snapshot script failed; falling back to robocopy")
      }
      await runRobocopy([ws.path, treeDir, ...COMMON.filter((x) => x !== "/MIR")], ws.path)
      await writeManifest(ws.path, session.id, boundarySeq, ws.cwd)
    }

    async function recordCheckpoint(session, boundarySeq) {
      const ws = await workspaceOf(session)
      if (ws === null) return
      try {
        let cfg = { gitAutoCommit: true }
        try { cfg = await readConfig(ws.path) } catch (e) { /* default */ }
        if (cfg.gitAutoCommit !== false && (await inGitRepo(ws.path))) {
          const commit = await gitCommitSnapshot(ws.path, boundarySeq)
          if (commit) {
            await writeManifest(ws.path, session.id, boundarySeq, ws.cwd, commit)
            return
          }
          console.error("[rlbk] git checkpoint failed; falling back to file snapshot")
        }
        await recordFileSnapshot(session, boundarySeq, ws)
      } catch (e) {
        console.error("[rlbk] checkpoint failed", session.id, boundarySeq, String((e && e.message) || e))
      }
    }

    const queues = new Map()
    function queueCheckpoint(session, boundarySeq) {
      const sessionId = session.id
      let q = queues.get(sessionId)
      if (!q) {
        q = { busy: null, pendingSeq: null }
        queues.set(sessionId, q)
      }
      if (q.busy === null) {
        q.busy = (async () => {
          do {
            const seq = q.pendingSeq !== null ? q.pendingSeq : boundarySeq
            q.pendingSeq = null
            await recordCheckpoint(session, seq)
          } while (q.pendingSeq !== null)
          q.busy = null
        })()
      } else {
        q.pendingSeq = boundarySeq
      }
    }

    ctx.on("session/event", (session, event) => {
      if (!event || event.type !== "turn/end") return
      const depth = session.header && session.header.delegationDepth
      if (typeof depth === "number" && depth > 0) return
      queueCheckpoint(session, event.seq)
    })

    async function checkpointExists(wsPath, sessionId, boundarySeq) {
      try {
        const target = await fs.resolve(joinPath(checkpointDir(wsPath, sessionId, boundarySeq), "manifest.json"))
        const info = await fs.stat(target)
        return info !== undefined
      } catch (e) {
        return false
      }
    }

    async function listCheckpoints(wsPath, sessionId) {
      const out = []
      for (const bs of await listCheckpointDirs(wsPath, sessionId)) {
        if (await checkpointExists(wsPath, sessionId, bs)) out.push(bs)
      }
      return out
    }

    // ---- RPC handlers (called by the client through /rollback/rpc) ----

    async function rpcInit(args) {
      const sessionId = args.sessionId
      if (typeof sessionId !== "string") return { ok: false, reason: "bad-args" }
      const session = sessions.get(sessionId)
      if (session === undefined) return { ok: false, reason: "session-not-found" }
      const ws = await workspaceOf(session)
      if (ws === null) return { ok: false, reason: "no-workspace" }
      const events = session.events
      const last = events.at(-1)
      const midTurn = last !== undefined && last.type === "turn/start"
      if (!midTurn) {
        let bs = -1
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === "turn/end") { bs = events[i].seq; break }
        }
        if (bs >= 0 && !(await checkpointExists(ws.path, sessionId, bs))) {
          await recordCheckpoint(session, bs)
        }
      }
      const checkpoints = await listCheckpoints(ws.path, sessionId)
      return { ok: true, checkpoints }
    }

    async function rpcConfigGet(args) {
      const sessionId = args.sessionId
      if (typeof sessionId !== "string") return { ok: false, reason: "bad-args" }
      const session = sessions.get(sessionId)
      if (session === undefined) return { ok: false, reason: "session-not-found" }
      const ws = await workspaceOf(session)
      if (ws === null) return { ok: false, reason: "no-workspace" }
      let cfg = { gitAutoCommit: true }
      try { cfg = await readConfig(ws.path) } catch (e) { /* default */ }
      let inRepo = false
      try { inRepo = await inGitRepo(ws.path) } catch (e) { /* ignore */ }
      return { ok: true, gitAutoCommit: cfg.gitAutoCommit === true, inGitRepo: inRepo }
    }

    async function rpcConfigSet(args) {
      const sessionId = args.sessionId
      const gitAutoCommit = args.gitAutoCommit
      if (typeof sessionId !== "string" || typeof gitAutoCommit !== "boolean") {
        return { ok: false, reason: "bad-args" }
      }
      const session = sessions.get(sessionId)
      if (session === undefined) return { ok: false, reason: "session-not-found" }
      const ws = await workspaceOf(session)
      if (ws === null) return { ok: false, reason: "no-workspace" }
      try {
        await writeConfig(ws.path, { gitAutoCommit })
        return { ok: true }
      } catch (e) {
        console.error("[rlbk] config write failed", String((e && e.message) || e))
        return { ok: false, reason: "write-failed" }
      }
    }

    async function rpcPrepare(args) {
      const sessionId = args.sessionId
      const kind = args.kind
      if (typeof sessionId !== "string" || (kind !== "user" && kind !== "assistant")) {
        return { ok: false, reason: "bad-args" }
      }
      const session = sessions.get(sessionId)
      if (session === undefined) return { ok: false, reason: "session-not-found" }
      const ws = await workspaceOf(session)
      if (ws === null) return { ok: false, reason: "no-workspace" }
      const events = session.events
      const last = events.at(-1)
      if (last !== undefined && last.type === "turn/start") return { ok: false, reason: "running" }

      let msgSeq = -1
      if (kind === "user") {
        const seq = args.seq
        if (!Number.isInteger(seq) || seq < 0 || seq >= events.length) return { ok: false, reason: "bad-args" }
        if (events[seq].type !== "user/message") return { ok: false, reason: "message-not-found" }
        msgSeq = seq
      } else {
        const messageId = args.messageId
        if (typeof messageId !== "string") return { ok: false, reason: "bad-args" }
        for (let i = 0; i < events.length; i++) {
          const e = events[i]
          if (e.type === "assistant/message" && e.data && e.data.message && e.data.message.id === messageId) {
            msgSeq = i
            break
          }
        }
        if (msgSeq < 0) return { ok: false, reason: "message-not-found" }
      }

      let boundary = -1
      for (let i = msgSeq - 1; i >= 0; i--) {
        if (events[i].type === "turn/end") { boundary = events[i].seq; break }
      }
      if (boundary < 0) return { ok: false, reason: "no-prior-turn" }

      if (!(await checkpointExists(ws.path, sessionId, boundary))) {
        return { ok: false, reason: "no-snapshot" }
      }

      const manifest = await readManifest(ws.path, sessionId, boundary)
      if (manifest && typeof manifest.gitCommit === "string" && (await git()) !== null) {
        const okGit = await gitRestore(ws.path, manifest.gitCommit)
        if (!okGit) return { ok: false, reason: "restore-failed" }
        return { ok: true, boundarySeq: boundary }
      }

      const treeDir = joinPath(checkpointDir(ws.path, sessionId, boundary), "tree")
      try {
        await runRobocopy([treeDir, ws.path, ...MIRROR_ARGS], ws.path)
      } catch (e) {
        console.error("[rlbk] restore failed", String((e && e.message) || e))
        return { ok: false, reason: "restore-failed" }
      }
      return { ok: true, boundarySeq: boundary }
    }

    const rpc = {
      init: rpcInit,
      "config.get": rpcConfigGet,
      "config.set": rpcConfigSet,
      prepare: rpcPrepare
    }

    async function readBody(req) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      return Buffer.concat(chunks).toString("utf8")
    }

    ctx.effect(() => webServer.register({
      kind: "exact",
      path: "/rollback/rpc",
      handler: async (req, res) => {
        try {
          if (req.method !== "POST") {
            res.statusCode = 405
            res.end("POST only")
            return
          }
          let payload = {}
          try {
            const body = await readBody(req)
            payload = JSON.parse(body || "{}")
          } catch (e) {
            payload = {}
          }
          const method = typeof payload.method === "string" ? payload.method : ""
          const args = payload.args && typeof payload.args === "object" ? payload.args : {}
          const fn = rpc[method]
          let result = { ok: false, reason: "unknown-method" }
          if (fn) {
            try {
              result = await fn(args)
            } catch (e) {
              console.error("[rlbk] rpc " + method + " failed", String((e && e.message) || e))
              result = { ok: false, reason: "internal" }
            }
          }
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error("[rlbk] rpc route error", String((e && e.message) || e))
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, reason: "internal" }))
        }
      }
    }))
  }
}
