# DeepSeek Harness for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

在 **VS Code** 内以 Webview 方式运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原生网页界面。扩展已内置全部宿主依赖与生态插件，用户机器 **无需安装 Node.js、npm、pnpm 或 Python** —— VS Code 自身即为运行时。

## ✨ 特性

- **零依赖开箱即用**：宿主运行时、网页前端、生态插件全部打进扩展，一条 `.vsix` 完成安装。
- **原生 DSH 体验**：完整渲染 Harness 网页界面（模型对话、工具调用、工作区、会话管理），无二次封装。
- **内置插件（精简集）**：分层记忆、自动续写、PPT↔HTML 桥、网页预览四个插件随附启用。
- **对 DSH 零改动**：利用本地回环端口映射（`WebviewPortMapping`）+ 信任边界机制接入，不修改 DSH 任何源码。
- **多窗口隔离**：每个 VS Code 窗口独立宿主实例、独立端口，互不冲突。
- **丰富操作命令**：打开面板、重启宿主、外部浏览器逃生、查看宿主日志。

## 🚀 快速开始

1. 在 [Releases](https://github.com/li554/dsh-vscode/releases) 下载最新的 `dsh-vscode.vsix`。
2. VS Code 内打开 **扩展视图** → 右上角 `⋯` → **从 VSIX 安装...**，选择下载的文件。
3. 按 `Ctrl+Shift+P` 打开命令面板，执行 **`DSH: Open`** 打开 Harness 面板。

> 要求 VS Code `^1.133.0`。建议启用信任的工作区（扩展会读写文件并执行命令）。

## 📖 常用命令

| 命令 | 说明 |
| --- | --- |
| `DSH: Open` | 打开 Harness 面板（按需启动宿主进程） |
| `DSH: Restart Host` | 结束并重启宿主，重建面板 |
| `DSH: Open in External Browser` | 在系统浏览器中打开同一宿主地址（逃生通道） |
| `DSH: Show Host Logs` | 打开宿主 stdout/stderr 的输出通道 |

## ⚙️ 设置

| 配置项 | 说明 |
| --- | --- |
| `dsh.openOnStartup` | 启动时自动打开面板（仅信任工作区生效） |
| `dsh.cwd` | 宿主工作目录（即 agent 的工作目录），留空 = 首个工作区文件夹 |
| `dsh.dshHome` | 覆盖 `DSH_HOME`（配置、会话、插件数据等存放位置），留空 = DSH 默认路径 |
| `dsh.enableBakedPlugins` | 是否启用内置生态插件（默认 `true`） |
| `dsh.modlensFamilies` | **追加**给 `@liustack/modlens` 的「纯文本、可桥接」**模型 id 前缀**列表。它自带默认 `deepseek`/`glm`/`mimo`；当你的 provider 用不透明别名（例如某网关把 DeepSeek/GLM 藏在 `code_instuct`、`code_think` 后面）时在这里补上。**你填的项会与内置三项合并，永远不会把它们挤掉**（modlens 内部是 `config.families \|\| [默认]`，只发你填的会替换掉默认）。留空 = 完全不覆盖。**改动会自动重启宿主**（插件 config 在装配时读取，必须重开宿主才生效） |

> `dsh.modlensFamilies` 不是写进你的 `<profile>/cordis.patch.yml`，而是由扩展生成一个覆盖层文件 `<DSH_HOME>/.dsh-vscode-profile-patch.yml`，再用 `dsh --patch` 传进去。DSH 的合成顺序是「bundles → `cordis.patch.yml` → 各 `--patch`」，所以覆盖层叠在你自己的补丁之上，**永远不会改写你自己维护的那个文件**。留空则删除该文件、不传 `--patch`。
>
> 匹配规则（modlens 内部，大小写不敏感）：先去掉开头的 `~` 别名标记与 `vendor/` 命名空间，再按**前缀**匹配。所以 `deepseek-chat` 命中内置的 `deepseek`，而 `code_think` 什么都匹配不到——除非你把它加进来。**建议显式列出家族而不是写 `*`**：不在具名家族里时它还会额外要求模型目录声明 `text` 输入，而第三方目录通常不给这个元数据，结果 `*` 反而一个都不包。

## 🔌 内置插件

> **探索分支说明**：本分支（`explore/dsh-0.1.5-rc2`）把内置平台升级到 `@deepseek-ai/dsh@0.1.5-rc.2`，并把内置插件从原先的整套生态**裁剪为下面 5 个**，其余全部移除（见 `src/extension.js` 的 `RETIRED_PLUGINS`，旧 `DSH_HOME` 里的残留插件会在下次启动时被清理）。

扩展在 `plugins/bundled` 下随附以下插件（各自保留原 LICENSE）：

| 插件 | 来源 | 说明 / 本地改动 |
| --- | --- | --- |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 请求被网络错误等非人为原因中断时自动续写（升到 0.11.5） |
| `@canglongcl/dsh-web-review` | canglongcl | 页面预览 + 元素框选批注 + 视觉调整（升到 0.6.0；0.6.0 起它自己也已改用官方 slot，不再依赖 better-sidebar）。有一处本地修补：批注草稿按 sessionId 存，不要求会话有活跃 agent，见下 |
| `dsh-undo-plugin` + `@dsh-undo/*`（7 个成员包） | [23swccp/dsh-undo](https://github.com/23swccp/dsh-undo) | 对话回退/撤销：`/undo` 命令、消息行与头部回退按钮、回退时 fork 到新会话（模型不会看到被撤销的提示）、设置页「归档任务」管理器、影子 Git 文件恢复（绝不碰项目自身的 `.git`）。`rollback-fork` 有一处针对 0.1.5 的本地修补，见下 |
| `@dsh-vscode/p2h-bridge` | 本仓库自研 | PPT↔HTML 桥：`slides_import`/`slides_export` 宿主工具、`/html-slides` 静态预览路由、以及对话区的「PPT」标签页（导入 / 内联预览 / 导出 / 上传管理）。设计文档见 `docs/superpowers/specs/2026-08-29-dsh-ppt-html-review-workflow-design.md` |
| `@liustack/modlens` | [liustack/modlens](https://github.com/liustack/modlens) | **视觉插件**：给纯文本模型（DeepSeek/GLM 等）加「看图」能力，粘贴图片返回结构化 JSON 证据（OCR + 版面 + 语义）。提供 `modlens_read_image` 工具、图片粘贴处理、`(modlens vision)` 模型变体与设置卡片。自带 `node_modules/{commander,undici}` 供它 spawn 的 CLI 使用，见下 |
| `dsh-mnemon` | [omdsh-dev/dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon) `0.5.8` | **三层记忆**（Runtime / Documents / Memory Spaces）。Starter + 3 Source + Strategy + 9 Provider 作为 sibling 包 transplant；`zod`/`fflate`/`schemastery` 等在 `_hostdeps`。**Mnemon Native** 使用 vsix 内置的 `@mnemon-dev/mnemon@0.2.8` win32-x64 二进制，宿主启动时设 `MNEMON_CLI_PATH`，**无需联网、无需全局装 CLI**。 |
| `_hostdeps/`（docgen-utils、fontkit、jszip、linkedom 及其闭包） | npm 包 | p2h-bridge 宿主侧所需的非平台依赖，内置以便离线解析 |

> `dsh-undo-plugin` 只是 bundle 层，真正的插件是它 cordis patch 挂载的 7 个 `@dsh-undo/*` 成员包——所以它们不在 `BUNDLED_PLUGINS` 里，由 `.smoke/selfcontained-plugins.mjs` 按「被 patch 认领」校验。

> **`@liustack/modlens` 需要自己配一个视觉引擎才能读图**。它与平台几乎没有耦合（宿主半只 import node 内建，客户端半只 require `react` + `dsh-client-ui-primitives`，都来自前端共享表），并且**已经内置了 Electron 部署的处理**：它 spawn `process.execPath <dist/main.js>` 时显式设 `ELECTRON_RUN_AS_NODE=1`，所以用 VS Code 二进制当 Node 跑得通（实测 `--version` 正常）。
> 它的配置在 **`~/.modlens/config.json`**（不在 `DSH_HOME` 内，因此残留清理逻辑碰不到它）。装完先跑 `doctor` 看引擎状态，再按需配一条：`modlens config set gemini-api.apiKey`（免费、5-10 秒）、或把它指到任意 OpenAI 兼容的视觉端点：`modlens config set openai.baseUrl <url>` / `openai.apiKey` / `openai.model`。

**本分支的本地改造（相对上游）**

- `@deepseek-ai/dsh-client-ui-settings-models`（explore.24）：自定义模型「容量与能力」增加 **支持图像** / **推理模型** 开关。推理开关写入 `reasoningEfforts: {low,high,max}`；**对话框模型选择器**（`dsh-client-ui-model-selection`）对声明了 reasoning 的模型显示 **Default / Low / High / Max**，与官方模型同一套 UI，不在设置卡片里选档。
- `@dsh-vscode/p2h-bridge` 0.2.1 → 0.3.0：原本是挂在 `dsh-better-sidebar` 标签栏里的侧边栏标签页，现改为注册平台官方 slot `conversation.view`（`order: 15`），**紧邻「轨迹」标签页右侧**；同时移除对 `betterSidebar` 服务的全部探测与 web-review 预览标签页的外部驱动（web-review 0.6.0 已不再提供该公开 API），预览改为面板内联 iframe + 「新窗口」兜底。调研与 0.1.1→0.1.5 API 差异见 `docs/superpowers/specs/2026-09-01-p2h-bridge-conversation-view-tab-research.md`。
- `@dsh-undo/rollback-fork`：上游 `@deepseek-ai/dsh-agent-presets` 在 0.1.1-rc.2 之后删掉了 `resolveSessionPreset` 导出，而 dsh-undo rc.8 正是 `import` 它——**这会让整个宿主启动失败**（cordis 报的是「加载插件失败」，看不出根因在平台）。已把 0.1.1 那个 8 行实现内联回来（0.1.5 仍在产生它依赖的 `agent-preset/selected` 事件与 `header.agentPreset` 字段）。用 `.smoke/platform-api-scan.mjs` 可一次性扫出这类断裂。
- `@canglongcl/dsh-web-review` 的 `storeAnnotationSnapshot` + 客户端清除路径：**批注同步/清除不应因「无 live agent」或「宿主短暂不可达」报「注释上下文同步失败」**。上游把 pending 绑在 `agents.get(sessionId)` 上，取不到 live agent 就 **404 `session not found`**；且客户端只容忍「清除 + 404」，宿主重启/被 SIGTERM 时的网络错误或 502 会让 dock 卡在「正在清除注释 / 同步失败」。批注本质上只是「下一轮 user message 的历史上下文」：已改为 **pending 按 sessionId 存**（`agent.id` 就是 sessionId），空/非空草稿在无 agent 时都可写入；注入仍走 `agent/pre-step`；**不再**在 `agent/disposed` 时丢掉未注入草稿。客户端：**空草稿（清除）在任何 fetch 失败/非 2xx/非法回执时都视为成功**（浏览器已丢掉 picks，宿主 pending 本就随进程消失），非空路径的错误上报原样保留。已验证与扩展代理无关：同一请求直连宿主与经代理返回完全一致。
- **已移除 `dsh-memory-evolve`**（explore.17）：切会话时 Advisor 面板对无 live agent 的 sessionId 连打 `status/instructions/scopes/events`（全部 400），并疑似与宿主异常退出相关。已从 `BUNDLED_PLUGINS` 摘掉、列入 `RETIRED_PLUGINS`（启动时从 profile `bundles` 与 `node_modules` 清理），插件目录不再打包。
- **宿主意外退出后自动恢复**（`src/extension.js`）：宿主被 SIGTERM（窗口重载、扩展宿主回收、`DSH: Restart` 等）后，旧代码只尝试改写 `webview.html`——而 VS Code 对**已渲染**的 view 改 html **不会重绘**（见 `resolveWebviewView` 注释），于是旧 iframe 留在原地，技能等面板的 `fetch` 全部变成 `Failed to fetch`。现改为：非 shutdown 退出时自动 `ensureHost()` 并 `postMessage` 让 shell 重载 iframe（与 `restartHost` 同路径）；3 秒冷却防止崩溃循环；连续失败才退回错误页。
- **执行命令时不再弹出命令行窗口**（`@deepseek-ai/dsh-subprocess-local`，见 `.smoke/platform-patches/`）：Windows 上跑普通命令走的是 `launchWindowsJob`，它 spawn 托管 job runner 时**漏了 `windowsHide`**，于是 Windows 给 runner 分配一个控制台 → **命令开始时弹窗、结束时消失**。这是上游的疏漏而非设计：**同一个包里的 fallback 路径 `spawnSubprocess` 早就写了** `windowsHide: platform === "win32"`（就在 `detached: platform !== "win32"` 旁边），只有 Windows 正常走的那条路忘了。补丁加上该选项（非 Windows 平台忽略）。
  > 这个调用点靠「grep `spawn(`」是**找不到**的——它写作 `(internals.spawn ?? spawn)(`，`spawn` 后面跟的是 `)`；而「这个文件里有没有 `windowsHide`」也会漏，因为**同一个包里 `runner-launch` 的 taskkill 调用确实设了**。我是把全树每个 `child_process` 调用点的**参数对象**逐一审出来才定位到的。
- **斜杠指令恢复显示**（`@canglongcl/dsh-web-review` 客户端半边，本地补丁）：打出 `/` 时**只列出技能、指令全不见**（`/goal`、`/compact`、`/model`…）。原因是 0.1.5 的客户端用
  ```js
  rows.push({ name: contribution.name, description: contribution.description() })
  ```
  构造菜单——**它把 `description` 当函数调用**，所以贡献必须给它一个 thunk（平台自己写的是 `description: () => t("command.description")`）。而 web-review 是按**旧版客户端**写的（那时接受字符串），传的是 `description: t("command.skills.description")`，于是抛 `TypeError: contribution.description is not a function`。因为这个候选构造是**一个函数**，异常会让**整个指令源**失败——症状不是「少了一条指令」，而是**一条都没有**，只剩技能。补丁把它改成 thunk（顺带让描述能跟随语言切换重新翻译）。新测试 `.smoke/client-command-shape.mjs` 扫描 `plugins/bundled` 里**所有客户端包**（认 `__ModuleLoader__` 标记，因此主机侧用字符串的 `@dsh-undo` 不会被误判）并断言每处注册的 `description` 都是函数。
- **归档任务恢复可读**（`@deepseek-ai/dsh-session-persistence-jsonl`，见 `.smoke/platform-patches/`）：设置里的「归档任务」一直报「暂时无法读取归档任务」，浏览器控制台给出的真实原因是
  ```
  sessionArchive.list failed gateway/internal: this.ctx.sessionPersistence.inspect is not a function
  ```
  内置的 `@dsh-undo/*` 是照**更新的持久化契约**写的（服务上有个 `inspect(id)`），而 0.1.5-rc.2 的这个后端没有它。服务基类本身只是个空壳（`class extends Service { constructor }`），方法都在 jsonl 后端里，它的 API 是 `locate/create/open/flush/stat/list/requireStoredLog`——**恰好没有 `inspect`**。之所以只有「归档」坏：调用方优先用 `ctx.sessions.get(id)?.events`，**只有对没有活动句柄的会话（也就是归档的那些）才回退到持久化**。补丁基于已有的 `open(id, 'read')` + `handle.read()` 实现了 `inspect(id, options)`，**不引入任何新的存储行为**，调用方只读 `.events`。测试 `.smoke/persistence-inspect-test.mjs` 是**行为断言**——真的把模块 import 进来，检查 `inspect` 是原型上的 2 元函数，并确认 `open`/`list`/`locate` 仍在（否则它就是死代码）。
  > 顺带记一条踩过的坑：`sessionPersistence.inspect` 这类**客户端与服务端的契约错配**，错误信息只会出现在**浏览器控制台**，不会进宿主日志。所以「宿主日志里什么都没有」根本不能证明插件没出问题。
- **「打开配置文件」内嵌桥接恢复**（`@deepseek-ai/dsh-api-settings-controller`，见 `.smoke/platform-patches/`）：0.1.1 时这个职责在 `dsh-host-apiproxy` 里——`DSH_EMBEDDED=1` 时把设置文档路径打到 stdout（`[dsh-vscode:open-settings] <path>`），由扩展在 VS Code 编辑器里打开，因为**内嵌部署下原生打开器用户根本看不见**。0.1.5 删掉了 `dsh-host-apiproxy`，设置职责搬到 `dsh-api-settings-controller`，而那里的 `openSettingsDocument` **无条件**调用 `openTextFile`：环境变量判断和哨兵都没了，也没有 `openAgentPresetDirectory` 那样的「返回路径」分支。0.1.5 全平台**不再读取 `DSH_EMBEDDED`**（仅剩 `DSH_AGENTS_HOME`、`DSH_BUNDLED_SKILL_DIR`、`DSH_TELEMETRY_DISABLED`、`DSH_WEB_FETCH_PROVIDER`、`DSH_WEB_SEARCH_PROVIDER`），没有官方接缝可用——于是面板里点「打开配置文件」**毫无反应**。已在接手同一职责的 handler 里恢复该分支，并保留 `internals.openTextFile` 接缝（`.smoke/embedded-open-settings-test.mjs` 用桩驱动真实 controller，验证开/不开 `DSH_EMBEDDED` 两种路径）。
- **会话格式迁移的插件兼容层**（`@deepseek-ai/dsh-session-format-v0-to-v1`，见 `.smoke/platform-patches/`）：0.1.5 引入了会话格式版本化，v0→v1 迁移对「已发布 v0 规格」之外的内容**一律拒绝**，且一个事件不合格就让整个会话无法读取。而**第三方插件当年往 v0 会话里写了不少规格外内容**，于是升级后旧历史打不开。已加入四类容错（各自只记录一次日志，原始 v0 文件永不修改）：丢掉内容块上的插件注解（`dsh-file-review` 的 `dshFileReview`）、丢掉插件 source 上的多余成员（`dsh-web-review` 的 `snapshotId`）、丢掉非 `notice` 形式下多余的 `summary`（`dsh-mnemon`）、把 `subagent/descriptor` 的 version 2 提升为 3（`sidechat` 插件）。实测某份 30 会话的真实历史：修复前 **21 个会话、1251 个事件被拒**，修复后 **0**。容错时会打印形如 `[dsh-session-format-v0-to-v1] note: tolerated plugin-authored v0 data: dropped member "dshFileReview"` 的提示——**这是通报不是报错**（会话照常加载，只是丢弃了某个插件加进去的字段），每种形状只打一次，且走 stdout 所以不会显示成 `[host-err]`。
- **升级残留自动清理**（`pruneRetiredArtifacts`，每次启动宿主前运行）：反复升级的 `DSH_HOME` 会积累三类没人清理的残留。
  1. **失效或指向旧安装的模块回退链接**：`<home>/profiles/node_modules` 是大量指向「当前扩展 vendor 树」的 junction，而 DSH 自己的修复**只遍历当前版本依赖闭包里的包**，并且**在目标仍然存在时完全不动这条链接**——于是「装新版但不卸载旧版」留下一个致命后果：**模块仍从旧扩展的 vendor 树解析，宿主跑的还是上一版的平台代码，新版 vsix 里的平台补丁永远不会被加载**。实测某台机器上 **240 条**链接全部指向 `0.3.0-explore.25`，其中 `dsh-subprocess-local` 正是**没有** `windowsHide` 补丁的那一份——这就是「补丁明明修了、仍然弹窗」的原因。另一类是完全悬空的链接（实测 17 条指向已卸载的 `0.2.53`，含 `dsh-client-runtime`、`dsh-host-apiproxy` 等 0.1.5 已删除的平台包，以及 `react`/`react-dom`/`zustand`/`immer`/`clsx` 一族）。两者都会被删除，DSH 随后用**正在运行的**那份安装重建它们。
     > 规则仍收得很窄：目标已不存在的删；指向**别的安装**的，**只有当「当前这份」确实带这个包时**才删（那才叫改正），否则保留——因为 `katex`、`shiki` 这类包并不在 0.1.5 的 vendor 闭包里，链接可能是唯一副本，删掉是倒退而不是清理。这类「保留」只在日志里提示一次。
  2. **profile 清单残留**：`dependencies` 里指向本扩展 `plugins/bundled` 的 `link:` 条目（开发残留，会让 pnpm 重建移植逻辑刻意替换掉的链接）、以及已退役插件的名字。
  3. **结构性残渣**：空 `@scope` 目录、`*.pnpm-old` 重链接备份、`.ignored_*` 改名目录、`cordis.patch.yml.bak-*`。
  4. **已退役插件的状态目录**（`super-injector/`、`diff-review/`、`change-ledger/`、`doctor/`、`pet.json`、`dsh-easyrewrite.log`）**移动**到 `<home>/.dsh-vscode-retired/<时间戳>/` 隔离，**从不删除**，可随时搬回。
  > **绝不触碰**：会话、记忆、附件、storages、`settings.yaml`、凭据、`.agent-presets/`、以及在用插件的状态（`rollback-undo/`、`rollback-archive/`）。这些都不在 `profiles/**/node_modules` 路径下，所以清理的触及范围是结构性受限的；`.smoke/legacy-cleanup-test.cjs` 会逐条断言它们一个字节都没变。`task-board/` 与 `router-standard/` 同样**不动**（前者是你的任务数据，后者可能被仍在随附的 preset 读取），只会在日志里提示。
- **宿主接入改动**：0.1.5 给整个 Web 界面加了「每进程启动令牌」，裸 `GET /` 返回 401，扩展改为在扩展宿主侧完成令牌交换并起本地中转代理（详见下方「工作原理」第 4 条）。

## 🛠️ 从源码构建

### 环境要求

- Git
- Python 3（用于打包脚本）
- 无需 Node.js/npm：构建产物由本仓库已提交的 `vendor/` 与 `plugins/bundled/` 直接打包

### 仓库结构

```
dsh-vscode/
├── vendor/            # DSH 宿主平台依赖树（已提交，构建时整体打包）
├── plugins/
│   ├── bundled/       # 内置生态插件（自包含，含 _hostdeps 宿主依赖）
│   ├── presets/       # 内置 agent 预设（router-standard / router-spec）
│   └── node_modules/  # 插件扁平安装树（仅本地生成用，不入库）
├── src/extension.js   # 扩展入口：宿主 fork、插件移植、配置同步
└── .smoke/            # 打包脚本与冒烟测试
```

### 打包

```bash
# 生成 dsh-vscode.vsix（标准 zip + vsix 清单，剔除 *.map）
python .smoke/pack.py
```

> 优先使用 `.smoke/pack.py` 而非 `npx @vscode/vsce package`：vsce 的依赖清单校验不兼容 pnpm 扁平布局，且文件遍历明显更慢。

### 冒烟测试

| 脚本 | 作用 |
| --- | --- |
| `.smoke/platform-api-scan.mjs` | 扫描内置插件对平台（`@deepseek-ai/*`）的每一个具名 import，核对当前 vendor 树是否仍导出它。**升级平台后应先跑这个**——插件是外部预构建产物，平台删掉一个导出会让宿主启动时直接崩，而报错只提插件不提根因 |
| `.smoke/session-history-check.mjs` | 用平台自己的 v0 会话校验器扫一遍某个 `DSH_HOME` 下的全部历史会话，报告哪些会话会被**拒绝加载**以及原因。升级平台后检查旧历史是否还能读时用 |
| `.smoke/platform-patches.py` | `verify` / `apply` 保存在 `.smoke/platform-patches/` 的 vendor 平台补丁。**`vendor/` 整体重建后必须跑 `apply`**；`pack.py` 会在打包前自动 verify，补丁缺失直接拒绝打包 |
| `.smoke/boot-test.mjs` | 起真实宿主 + 临时 `DSH_HOME`，移植 `plugins/bundled`，断言首页与每个 **web 客户端**条目的带 revision 插件 URL 都返回 200、且在前端模块图里有对应行 |
| `.smoke/extension-proxy-test.cjs` | 用 stub 的 `vscode` 模块加载真实 `src/extension.js`，跑 `activate()` 起宿主与鉴权中转代理，然后**不带 Cookie** 去探测代理端口：首页须 200、未知 `/api` 通道不得是 401/403、`ws://…/api/remote.mux` 须返回 101 |
| `.smoke/annotations-clear-test.mjs` | 驱动真实宿主（经扩展代理，即 webview 实际路径）验证：无 live agent 时 `comments: []` 返回 `200 {kind:"empty"}`，非空草稿返回 `200 {kind:"ready", snapshotId}`（按 sessionId 暂存），清空后再写再清均成功，并证明直连与经代理结果一致 |
| `.smoke/profile-overlay-test.mjs` | 验证 `dsh.modlensFamilies` → `--patch` 覆盖层这条链路：驱动真实 `activate()` 断言覆盖层已生成且 YAML 转义正确（含 `:` 和引号这类值）、**你自己的 `cordis.patch.yml` 未被改写**、诊断日志已带启动头落盘，并用 `dsh --dump-config` 证明 DSH 真的把它合成到了 modlens 行上——而且**一个不少地保留其余行**（对比开关覆盖层前后的行集合；若某个 `id` 行被当成顶层条目重新组装整棵树，其它插件会全部掉线而旧断言仍然通过） |
| `.smoke/persistence-inspect-test.mjs` | **行为断言**：真的 import 0.1.5-rc.2 的 jsonl 持久化后端，检查 `inspect` 是原型上 arity 2 的函数，并确认它依赖的 `open`/`list`/`locate` 仍在（否则补丁就是死代码）。这是「归档任务」从 `sessionPersistence.inspect is not a function` 恢复可读的那处补丁的守护 |
| `.smoke/bundled-patches.mjs` | 断言我们对**内置第三方代码**的每个本地补丁都还在（含 web-review 的 thunk、undo 归档错误不再被吞）。内置插件每次启动会从 `plugins/bundled` 重新移植，补丁能扛过重启，但**扛不过上游刷新**——那会静默还原，于是现在会在这里失败 |
| `.smoke/client-command-shape.mjs` | 扫描 `plugins/bundled` 里所有**客户端包**（以 `__ModuleLoader__` 识别），断言每处 `command.register({...})` 的 `description` 都是**函数**——0.1.5 客户端会调用它，传字符串会让**整个 `/` 指令源**报错消失（只剩技能）。用真实浏览器复现过：修复前控制台 1 条 `TypeError`、菜单无指令；修复后 0 条错误、`/goal` `/compact` 等全部列出 |
| `.smoke/windows-hide-test.mjs` | 验证执行命令不再弹窗：断言 `launchWindowsJob` 的 spawn 参数带**无条件** `windowsHide: true`、且 fallback 路径仍保留自己的设置；并**实测机制**——让子进程报告 Windows 是否给它分配了控制台（`windowsHide` 走 `CREATE_NO_WINDOW`，返回 `NO_CONSOLE` 故不可能有窗口；不设则被分配控制台，在无控制台的 Electron 宿主里就是可见窗口） |
| `.smoke/embedded-open-settings-test.mjs` | 用桩驱动真实的 `SettingsController`，验证「打开配置文件」在 `DSH_EMBEDDED=1` 时输出扩展哨兵且**不**调用原生打开器，未设置时走原生路径 |
| `.smoke/legacy-cleanup-test.cjs` | 用合成 `DSH_HOME` 复现每一类升级残留（悬空/跨版本/全局 npm 链接、失效 profile 依赖、空 scope 目录、`*.pnpm-old`、`.ignored_*`、`.bak-*`、退役插件状态），跑真实 `activate()` 后断言残留已清、**且会话/记忆/配置/在用插件状态逐字节未变**、退役状态可在隔离目录找回 |
| `.smoke/selfcontained-plugins.mjs` | 校验 `plugins/bundled` 与 `BUNDLED_PLUGINS` 一致：每个条目要么被声明、要么被某个条目的 cordis patch 认领；并拒绝任何仍注入已被删除的 `dsh-client-runtime` 的包 |

## 🧱 工作原理

1. 扩展在扩展宿主内以 `ELECTRON_RUN_AS_NODE=1` 方式 fork 内置 DSH 宿主：`dsh --profile web --port 0 --no-open`（宿主用 OS 分配的临时端口），用 VS Code 二进制充当 Node 运行时。
2. 宿主监听 `127.0.0.1` 的临时端口，提供预构建网页前端（`@deepseek-ai/dsh-web-frontend/dist`）。扩展在**固定端口**（`dsh.port`，默认 `37750`）上另起一个中转代理供 webview 使用，见第 4 条。
3. Webview 面板通过声明稳定的 `WebviewPortMapping`（`{ webviewPort: port, extensionHostPort: port }`，两者都是上面的固定端口），让 iframe 及全部 `/api` 请求落到该端口——也就是落在这个中转代理上。
4. **启动令牌 → Cookie → 本地中转代理（0.1.5 起新增）**：宿主启动时打印 `dsh web: http://127.0.0.1:<port>/?token=<launchToken>`，对根路径的裸 `GET /` 一律返回 `401`。0.1.5 的鉴权模型是：**只有** `GET /?token=<t>` 这一次请求会签发 `HttpOnly` 会话 Cookie 并 `303` 重定向到 `/`，此后首页与**每一个** `/api` 请求都**只认这个 Cookie**（`BrowserAuth.isAuthenticated`），且没有任何配置可以关闭。

   在 VS Code 里 webview iframe 属于**第三方上下文**（`vscode-webview://` 内嵌 `127.0.0.1`），其请求由 VS Code 的端口映射层中继而非渲染进程直发，因此中继响应上的 `Set-Cookie` 永远不会进入浏览器 Cookie 罐——重定向后的 `GET /` 不带 Cookie，面板就会显示 DSH 的 `dsh web authentication required` 页面。

   所以**不由浏览器承担认证**：扩展宿主自己完成 token 交换（普通 Node 请求，能拿到 `Set-Cookie`），并在端口映射指向的稳定端口上运行一个**本地回环反向代理**。代理负责注入 Cookie，并剥掉 DSH 的 Host/Origin 围栏会拒绝的浏览器标记（`Sec-Fetch-Site: cross-site` 是硬 403，跨源 `Origin`/`Referer` 也过不了同源检查）。**启动令牌完全不会进入 webview**。宿主本身改用 OS 分配的临时端口，`dsh.port`（默认 `37750`）现在描述的是代理端口。`DSH: Open in External Browser` 仍直接打开带 token 的宿主地址，由真实浏览器自行完成交换。
5. DSH Web 客户端仅使用 fetch + SSE（无 WebSocket），端口映射代理完全可以承载（中转代理是流式转发的，不缓冲 SSE）。
6. 插件前端资源不走裸 `/plugins/<id>/client.js`：0.1.5 的模块注册表只服务它自己广告的**带 revision 的合并 URL**（`/plugins/??<id>/client.js,…&rev=<hash>`），裸路径返回 404。

## ❓ 常见问题

**问：安装后宿主启动失败？**
答：确认 VS Code ≥ 1.133；查看 `DSH: Show Host Logs` 输出；若曾升级旧版本，可尝试 `DSH: Restart Host`。

**问：面板空白/页面加载不出来？**
答：执行 `DSH: Open in External Browser` 确认宿主是否正常服务；仍异常时通过日志定位或重置 `dsh.dshHome` 指定的配置文件目录。

**问：升级扩展后会话/配置会丢吗？**
答：不会。会话、设置等数据存放在 `dsh.dshHome`（默认 `DSH_HOME`）目录，与扩展安装目录相互隔离。

**问：日志怎么给你？（`DSH: Show Host Logs` 关掉窗口就没了）**
答：同一份日志现在**同时落盘**在 `<globalStorage>/your-publisher-id.dsh-vscode/dsh-vscode.log`（超过 4 MB 自动轮转为 `.log.1`）。每次启动会先写一段头信息——扩展版本、`DSH_HOME`、工作目录、`dsh.port`、是否启用内置插件——因为排障真正需要的上下文正是这些，而不是随后的散行。宿主 stdout/stderr、token 交换、代理的 401 与上游错误、以及**经代理返回的非 2xx 响应（含路径）**都会记进去；`/plugins/` 的包请求除外（页面陈旧时会合法 404），且每次会话最多记 200 行以免刷爆。

宿主起来后还会写一行**客户端表面**：

```
client surface: 65 mounted of 12 shipped (every shipped client plugin mounted)
```

「shipped」是移植进 `<profile>/node_modules` 的插件里声明了 `dsh.client` 的那些，「mounted」是宿主在 shell 里**真正公布**的客户端插件。**插件没挂载是无声的**——`inject` 得不到满足时宿主会直接跳过它，日志里一个字都不留（「撤回插件完全没输出」就是这么来的）。所以这一行专门把沉默变成名单：如果某个插件的 UI 什么都不做，看这里有没有 `shipped but NOT mounted: …`。**撤回功能**尤其适合用这行判断：`rollback-undo` 依赖 `sessionArchive`/`sessionFork`，只要链条上任一环没挂上，`@dsh-undo/client-rollback-button` 就不会被挂载——于是图标不出现、归档任务读不出来，同时日志一片安静。

**问：记忆标签页 / `Failed to fetch`？**
答：explore.17 起已**移除** `dsh-memory-evolve`。升级后重启宿主，旧 profile 里的该插件会被自动 prune；若仍看到记忆 Tab，执行 `DSH: Restart Host` 或重载窗口。`Failed to fetch` 通常是宿主进程已退出（见 Host Logs 的 `host exited` / `deactivate`），面板会自动尝试拉起；拉不起来再点 Restart Host。

**问：为什么 .vsix 有 100+ MB？**
答：完整运行时依赖树内置在扩展内以保证离线可用，体积换取了"零依赖、开箱即用"的体验。

## 👥 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——上游网页宿主
- [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)——@linxin666 插件生态
- [23swccp/dsh-undo](https://github.com/23swccp/dsh-undo) 等其他内置插件作者

## 📄 许可证

[MIT](LICENSE)