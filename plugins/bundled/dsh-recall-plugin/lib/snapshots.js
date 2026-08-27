/**
 * dsh-recall-plugin — 快照域（ctx 绑定的工厂，无模块级副作用）
 *
 * 职责：快照捕获（captureSnapshot）、索引落盘/载入/孤儿重建、
 * diff 清单（diffFor）、回退执行（rollbackFor）、会话切点解析
 * （resolveCutSeq）。依赖 store.js 的执行与存储层，脚本文本全部
 * 来自 rt.scripts（按平台选择的 scripts.pwsh.js / scripts.posix.js）。
 */

export function createSnapshots(ctx, rt, config) {
  const sessions = ctx.sessions
  const state = rt.state
  // 平台选择的脚本模板（rt.scripts = scripts.pwsh.js / scripts.posix.js）：
  // 两套导出同名接口但实现分属 pwsh/bash，所有调用统一走 S.*
  const S = rt.scripts
  // 基础排除表随调用透传给脚本模板（用户 config 可调，即时生效）
  // 运行时读取而非创建时快照：设置卡片热更新 baseExcludes 后，
  // 下一次快照/diff/回退立即按新排除表执行
  const BASE = () => config.baseExcludes

  // 连续失败熔断（issue #7）：失败快照的重试既无谓地全量扫描工作区，
  // 又持续写入无 tag 可达的残骸对象（实测一个下午 127GB）。连续
  // FUSE_AFTER 次失败后按 BASE 起步、指数翻倍、CAP 封顶的退避跳过
  // 快照——冷却期内的消息不产生快照点，换来磁盘与 CPU 止血；冷却期满
  // 自动重试，成功一次即全部复位，用户修好环境（如补排除配置）后
  // 无需任何手动干预。
  const FUSE_AFTER = 3
  const FUSE_BACKOFF_BASE_MS = 5 * 60 * 1000
  const FUSE_BACKOFF_CAP_MS = 60 * 60 * 1000
  const snapFailures = new Map()

  // 索引落盘：任意长度文本统一走 rt.writeTextViaShell（win32 base64
  // 分块 / POSIX stdin，实现见 store.js）——saveIndex 与 writeExclude
  // 曾逐字重复这套平台分叉，改一处漏一处的风险随合并消失。
  async function saveIndex(root, sessionId) {
    const store = state.stores.get(root)
    if (!store) return
    // 每条带 root：设置页「快照管理」要跨工作区展示列表，而 store 目录名
    // 是 root 的单向哈希、反解不了——index.json 是唯一能持久「哈希↔工作区
    // 路径」对应关系的地方。loadIndex 忽略 entry.root（以参数为准），
    // 旧版本插件读新索引也只取已知字段，双向兼容。
    const entries = Array.from(state.snapshots.entries())
      .filter(([, s]) => s.root === root)
      .map(([id, s]) => ({ id, time: s.time, root: s.root, sessionId: s.sessionId }))
    try {
      await rt.writeTextViaShell(store.dir + (rt.isWin ? '\\' : '/') + 'index.json', JSON.stringify(entries))
    } catch (error) {
      rt.recordError('recall saveIndex failed: ' + String(error))
    }
  }

  async function loadIndex(root, sessionId) {
    if (state.indexLoaded.has(root)) return
    const store = state.stores.get(root)
    if (!store) return
    try {
      const raw = S.stripBom(await rt.runShell(S.indexReadCmd(store.dir), { stdoutMaxBytes: 4194304 })).trim()
      if (!raw) { state.indexLoaded.add(root); return }
      const entries = JSON.parse(raw)
      if (!Array.isArray(entries)) { state.indexLoaded.add(root); return }
      for (const entry of entries) {
        if (!entry || typeof entry.id !== 'string') continue
        state.snapshots.set(entry.id, {
          root,
          time: typeof entry.time === 'number' ? entry.time : Date.now(),
          sessionId: entry.sessionId || sessionId
        })
      }
      // 只在读取链路全部走通后才标记已载入：若在 try 前抢先标记，
      // runShell 失败（shell 未就绪等）被吞后该 root 本次进程内被永久
      // 视为「已载入」，索引永远为空、撤回按钮消失直到重启 DSH。
      state.indexLoaded.add(root)
    } catch (error) {
      /* 索引缺失或损坏时按空历史处理；不标记已载入，下次自然重试 */
    }
  }

  // exclude.txt 原文读取（设置页编辑用）：stripBom 剥掉 PS 5.1 Set-Content
  // 写入的 UTF-8 BOM，避免设置页首行出现不可见的 \uFEFF；两套模板对缺失
  // 文件都输出空串，这里不用区分「没配过」和「配了空」。
  async function readExclude(store) {
    return S.stripBom(await rt.runShell(S.excludeReadCmd(store.excludeFile), { stdoutMaxBytes: 1048576 }))
  }

  // exclude.txt 原文写入（设置页保存）：先 mkdir 父目录兜底（home 根目录
  // /降级 store 目录被用户手滑删掉时，保存不该因此失败），写本体统一走
  // rt.writeTextViaShell，与 saveIndex 共用同一套平台分叉原语。
  async function writeExclude(store, text) {
    const body = String(text == null ? '' : text)
    const sep = rt.isWin ? '\\' : '/'
    const parent = store.excludeFile.slice(0, store.excludeFile.lastIndexOf(sep))
    await rt.runShell(S.mkdirScript(parent), { stdoutMaxBytes: 4096 })
    await rt.writeTextViaShell(store.excludeFile, body)
  }

  // 索引丢失时从仓库 tag 重建：tag 名 snap-<messageId> 本身就是快照主键
  async function rebuildOrphans(root, sessionId) {
    const store = state.stores.get(root)
    const gitExe = await rt.resolveGit()
    if (!store || !gitExe) return
    try {
      const listing = S.stripBom(await rt.runShell(S.listTagsScript(store, gitExe), { stdoutMaxBytes: 4194304 })).trim()
      if (!listing) return
      for (const name of listing.split(/\r?\n/)) {
        const id = name.trim().replace(/^snap-/, '')
        if (!id || state.snapshots.has(id)) continue
        state.snapshots.set(id, { root, time: 0, sessionId })
      }
      await saveIndex(root, sessionId)
    } catch (error) {
      rt.recordError('recall rebuildOrphans failed: ' + String(error))
    }
  }

  async function captureSnapshot(sessionId, messageId, time) {
    const root = await rt.resolveRoot(sessionId)
    if (!root) return
    // 熔断检查要在任何解析/建仓动作之前：冷却期内连 resolveStore 都
    // 不必跑，把失败重试的开销也一并止住
    const fused = snapFailures.get(root)
    if (fused && Date.now() < fused.skipUntil) return
    let store = await rt.resolveStore(root)
    store = await rt.tryUpgradeToHome(root)
    const ok = await rt.ensureGit(root, store)
    if (!ok) return
    await loadIndex(root, sessionId)
    try {
      const out = await rt.runShell(S.snapshotScript(root, store, state.gitExe, messageId, BASE()), { timeoutMs: 600000, stdoutMaxBytes: 65536 })
      snapFailures.delete(root)
      state.snapshots.set(String(messageId), { root, time: time || Date.now(), sessionId })
      await saveIndex(root, sessionId)
      setFeedback(messageId, { skipped: parseSkipped(out) })
    } catch (error) {
      rt.recordError('recall snapshot failed: ' + String(error))
      setFeedback(messageId, { failed: true, error: String(error).slice(0, 300) })
      await handleSnapshotFailure(root, store)
    }
  }

  // 脚本侧 fail-open 跳过的路径（--ignore-errors 下无法索引的目录，如无
  // 提交的嵌入式仓库）以「SNAP_SKIP <path>」行回传：这些路径不进快照，
  // 撤回时既不恢复也不会被删，用户应当知道快照少了什么。
  function parseSkipped(out) {
    const skipped = []
    for (const line of String(out || '').split(/\r?\n/)) {
      if (line.indexOf('SNAP_SKIP ') === 0) skipped.push(line.slice('SNAP_SKIP '.length))
    }
    return skipped
  }

  // 逐消息反馈写入（issue #7 失败可见性）：成功无跳过 → 清除（重试成功
  // 自愈）；失败/有跳过 → 记录。上限防泄漏：交替成功失败的长会话可以无限
  // 积累，Map 保插入序做 FIFO 淘汰。
  function setFeedback(messageId, rec) {
    const id = String(messageId)
    const keep = rec && ((rec.failed) || (Array.isArray(rec.skipped) && rec.skipped.length))
    if (keep) state.snapFeedback.set(id, rec)
    else state.snapFeedback.delete(id)
    if (state.snapFeedback.size > 200) state.snapFeedback.delete(state.snapFeedback.keys().next().value)
  }

  // snapshot-info 端点的反馈查询：优先逐消息记录；无记录但该 root 熔断中
  // 时反馈熔断状态（冷却期内的消息快照被静默跳过，客户端需要知道「不是
  // 还没好，是暂停了」）。客户端只对近 5 分钟的消息弹提示，历史消息查询
  // 不受影响。
  async function feedbackFor(sessionId, messageId) {
    const rec = state.snapFeedback.get(String(messageId || ''))
    if (rec) return rec
    if (!sessionId) return {}
    const root = await rt.resolveRoot(sessionId)
    if (root) {
      const f = snapFailures.get(root)
      if (f && Date.now() < f.skipUntil) {
        return { failed: true, error: '快照连续失败已暂停（熔断），约 ' + Math.ceil((f.skipUntil - Date.now()) / 60000) + ' 分钟后自动重试，详情见设置 · 插件配置 · 最近错误' }
      }
    }
    return {}
  }

  // 失败善后 = 清残骸 + 推进熔断。captureSnapshot 的调用方就是串行队列
  // （见 index.js 事件接线），这两个动作留在 catch 里顺势排队执行，
  // 与下一次快照天然互斥，无 git 锁竞态；自身整体 best-effort，
  // 清理失败不该让队列任务以异常收场。
  async function handleSnapshotFailure(root, store) {
    if (store && state.gitExe) {
      try {
        await rt.runShell(S.pruneScript(store, state.gitExe), { timeoutMs: 600000, stdoutMaxBytes: 4096 })
      } catch (error) {
        rt.recordError('recall prune after snapshot failure failed: ' + String(error))
      }
    }
    const f = snapFailures.get(root) || { count: 0, skipUntil: 0 }
    f.count++
    if (f.count >= FUSE_AFTER) {
      const backoff = Math.min(FUSE_BACKOFF_BASE_MS * 2 ** (f.count - FUSE_AFTER), FUSE_BACKOFF_CAP_MS)
      const wasFused = Date.now() < f.skipUntil
      f.skipUntil = Date.now() + backoff
      // 只在「未熔断→熔断」的跳变沿记录：熔断期间每条消息都会走上面的
      // 静默跳过分支，逐条记录会把最近错误环形缓冲刷成同一条目
      if (!wasFused) rt.recordError('recall snapshot fused after ' + f.count + ' consecutive failures, backoff ' + Math.round(backoff / 60000) + 'min for: ' + root)
    }
    snapFailures.set(root, f)
  }

  // POSIX 侧 diff 输出是 TSV「kind<TAB>path」逐行（bash 模板不拼 JSON，
  // 避免 jq 依赖与转义坑）；win32 侧是 ConvertTo-Json。这里按平台分叉解析。
  function parseChanges(text) {
    if (rt.isWin) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') return [parsed]
      return []
    }
    const out = []
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue
      const tab = line.indexOf('\t')
      if (tab < 0) continue
      out.push({ kind: line.slice(0, tab), rel: line.slice(tab + 1) })
    }
    return out
  }

  // 变更清单截断上限：防止超大工作区（几千个文件）把 DOM 与 JSON
  // 双双撑爆。清单对用户的价值集中在前若干条，其余以 truncated 计数
  // 汇总展示；total 保留完整计数让面板文案仍准确。
  const MAX_CHANGES = 500

  async function diffFor(messageId) {
    const snap = state.snapshots.get(String(messageId))
    if (!snap) return null
    const store = state.stores.get(snap.root)
    if (!store) return null
    // 8MB 上限：按平均每条 60 字节估算可容纳十余万条，正常项目远够；
    // 真超限时报错文案与「JSON 半截解析失败」的真实原因脱节，需显式检测
    const text = S.stripBom(await rt.runShell(S.diffScript(snap.root, store, state.gitExe, 'snap-' + messageId, BASE()), { timeoutMs: 600000, stdoutMaxBytes: 8388608 }))
    const trimmed = text.trim()
    if (!trimmed) return { changes: [], total: 0, truncated: false }
    const all = parseChanges(trimmed)
    return { changes: all.slice(0, MAX_CHANGES), total: all.length, truncated: all.length > MAX_CHANGES }
  }

  async function rollbackFor(messageId) {
    const snap = state.snapshots.get(String(messageId))
    if (!snap) return { ok: false, error: '该消息没有可用的项目快照' }
    const store = state.stores.get(snap.root)
    if (!store) return { ok: false, error: '快照存储不可用' }
    const text = S.stripBom(await rt.runShell(S.rollbackScript(snap.root, store, state.gitExe, 'snap-' + messageId, BASE()), { timeoutMs: 600000, stdoutMaxBytes: 65536 }))
    const m = text.trim().match(/^ROLLBACK_OK\s+(\d+)\s+(\d+)/)
    const deleted = m ? parseInt(m[1], 10) : 0
    const restored = m ? parseInt(m[2], 10) : 0
    return { ok: true, count: (Number.isNaN(deleted) ? 0 : deleted) + (Number.isNaN(restored) ? 0 : restored) }
  }

  // 在事件序列里找“该消息之前最近一次 turn/end 的 seq”。
  function scanCutSeq(events, messageId) {
    let anchor = -1
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e && e.type === 'user/message' && e.data && String(e.data.id) === String(messageId)) {
        anchor = i
        break
      }
    }
    if (anchor < 0) return null
    for (let i = anchor - 1; i >= 0; i--) {
      const e = events[i]
      if (e && e.type === 'turn/end' && typeof e.seq === 'number') return e.seq
    }
    return null
  }

  // 解析“整段回退”的会话切点：优先读 live 会话的内存事件（零 IO、毫秒级），
  // 冷会话回退到 sessionQuery.readSession；结果按 (会话, 消息) 缓存——
  // 消息一旦入日志，其之前的 turn/end 永不变化，缓存终身有效。
  async function resolveCutSeq(sessionId, messageId) {
    if (!sessionId || !messageId) return null
    const cacheKey = String(sessionId) + '\u0000' + String(messageId)
    if (state.cutSeqCache.has(cacheKey)) return state.cutSeqCache.get(cacheKey)
    let result = null
    const live = sessions.get(sessionId)
    if (live && Array.isArray(live.events)) {
      result = scanCutSeq(live.events, messageId)
    } else {
      const query = ctx.get('sessionQuery')
      if (query) {
        try {
          const log = await query.readSession(sessionId)
          result = scanCutSeq(Array.isArray(log && log.events) ? log.events : [], messageId)
        } catch (error) {
          result = null
        }
      }
    }
    state.cutSeqCache.set(cacheKey, result)
    return result
  }

  return { saveIndex, loadIndex, readExclude, writeExclude, rebuildOrphans, captureSnapshot, diffFor, rollbackFor, resolveCutSeq, feedbackFor }
}
