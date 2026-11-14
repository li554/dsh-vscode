# DeepSeek Harness for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

在 **VS Code** 内以 Webview 方式运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原生网页界面。扩展已内置全部宿主依赖与生态插件，用户机器 **无需安装 Node.js、npm、pnpm 或 Python** —— VS Code 自身即为运行时。

## ✨ 特性

- **零依赖开箱即用**：宿主运行时、网页前端、生态插件全部打进扩展，一条 `.vsix` 完成安装。
- **原生 DSH 体验**：完整渲染 Harness 网页界面（模型对话、工具调用、工作区、会话管理），无二次封装。
- **内置插件（精简集）**：三层记忆、自动续写、对话回退、PPT 大师预设、网页预览/批注、SSH 远程、Git 管理、架构图、服务化侧边栏（编辑器 + 终端 + 浏览器）、归档任务管理等插件随附启用。
- **对 DSH 零改动**：利用本地回环端口映射（`WebviewPortMapping`）+ 信任边界机制接入，平台代码只带少量可审计的本地补丁（`.smoke/platform-patches/`，打包前字节校验），不改插件源码之外的东西。
- **多窗口隔离**：每个 VS Code 窗口独立宿主实例、独立端口，互不冲突。
- **丰富操作命令**：打开面板、重启宿主、外部浏览器逃生、查看宿主日志。

> **平台版本**：内置 `@deepseek-ai/dsh@0.2.2-rc.2`（2026-11 升级；此前为 0.1.5-rc.2）。破坏性变更、逐项证据与后续升级方法见 [`docs/upgrade/0.2.2-deltas.md`](docs/upgrade/0.2.2-deltas.md)。

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

> `dsh.modlensFamilies` 不是写进你的 `<profile>/cordis.patch.yml`，而是由扩展生成一个覆盖层文件 `<DSH_HOME>/.dsh-vscode-profile-patch.yml`，再用 `dsh --patch` 传进去。DSH 的合成顺序是「bundles → `cordis.patch.yml` → 各 `--patch`」，所以覆盖层叠在你自己的补丁之上，**永远不会改写你自己维护的那个文件**。该覆盖层**始终存在**：它还会把目录选择器固定到纯 JS 的 `browse` 后端（替代旧的 `SSH_CONNECTION` 假 SSH hack——那个 hack 同时会让聊天窗口右上角的「用已安装的应用打开工作目录」按钮消失）。`dsh.modlensFamilies` 那一节仅在你配置了值时才会追加，留空则只有固定选择器的那一节。
>
> 匹配规则（modlens 内部，大小写不敏感）：先去掉开头的 `~` 别名标记与 `vendor/` 命名空间，再按**前缀**匹配。所以 `deepseek-chat` 命中内置的 `deepseek`，而 `code_think` 什么都匹配不到——除非你把它加进来。**建议显式列出家族而不是写 `*`**：不在具名家族里时它还会额外要求模型目录声明 `text` 输入，而第三方目录通常不给这个元数据，结果 `*` 反而一个都不包。

## 🔌 内置插件

> **平台版本说明（0.4.0）**：本版本把内置平台升级到 `@deepseek-ai/dsh@0.2.2-rc.2`（原 `0.1.5-rc.2`），内置插件整体刷新到声明 0.2.x 兼容的上游版本，并按 0.2.2 的新机制改写了预设与插件兼容性处理。升级影响、官方升级指南索引与逐项证据见 [`docs/upgrade/0.2.2-deltas.md`](docs/upgrade/0.2.2-deltas.md)，平台补丁的逐条裁决见 [`.smoke/platform-patches/NOTES-0.2.2.md`](.smoke/platform-patches/NOTES-0.2.2.md)。

扩展在 `plugins/bundled` 下随附以下插件（各自保留原 LICENSE）：

| 插件 | 来源 | 说明 / 本地改动 |
| --- | --- | --- |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 请求被网络错误等非人为原因中断时自动续写（0.19.0，设置改走 0.2.2 的 `Config`/`configForms`） |
| `@canglongcl/dsh-web-review` | canglongcl | 页面预览 + 元素框选批注 + 视觉调整（0.6.0）。本地修补三处：批注草稿按 sessionId 存、不要求会话有活跃 agent；命令描述改成 thunk；两处 0.2.2 API 适配（`ctx.layout.closeDetails?.()` 与批注 source 的 `plugin:dsh-web-review`），见下 |
| `dsh-rewind-plugin` | npm `dsh-rewind-plugin` `0.22.1` | 对话回退/撤销（取代此前的 `dsh-undo-plugin` 与 `@dsh-undo/*`）：`/undo`、消息行与头部回退按钮、回退时 fork 到新会话、影子 Git 文件恢复。一处本地修补：压缩（compaction）把目标消息移出模型上下文后仍可按 surface 覆盖节点撤回 |
| `dsh-ppt-master` | [npm `dsh-ppt-master`](https://www.npmjs.com/package/dsh-ppt-master) `1.0.8` | **PPT 大师预设**：源文档 → 八项确认闸门 → 逐页手写 SVG → 质检 → 视觉闸门 → 导出可编辑 PPTX。零运行时依赖，`skills/` 内置两个 PPT 技能。0.2.2 起**包本身只是 bundle-only shell**（`cordis.patch.yml` 为空）：预设声明由 `@dsh-vscode/presets` 统一持有，避免同一 `ppt-master` id 被声明两次；包仍随附以提供 `ppt-master-tools` 行与 `skills/` |
| `billion-context` | [ranxianglei/billion-context](https://github.com/ranxianglei/billion-context) `0.1.214` | **上下文压缩引擎**（0.4.3 起取代已退役的 `dsh-live-compact`）：把长历史压成紧凑表示，让 100K 上下文也够用（上游宣称 5× 省 token、单会话可跨月运行）。bundle patch 插入 `bili-native` + 常开的 `bili-compaction-gate`，并把四个内置预设的 `inject` 指向 `biliBasicCompactionPolicy`（补丁在 `@dsh-vscode/presets` **之后**应用才认得到这些行）；顺带重述 `llm-deepseek{,-account}` 的 `retryPolicy`（补上 `MALFORMED_RESPONSE`，否则一次工具参数 JSON 抖动就整轮失败）。设置页「billion-context 压缩代理」。**自带嵌套 `node_modules`**（`zod 4.6.7` 是上游精确 pin，`_hostdeps` 里的 `zod 4.6.4` 不能顶替；外加 `mysql2` 闭包） |
| `@liustack/modlens` | [liustack/modlens](https://github.com/liustack/modlens) `3.27.3` | **视觉插件**：给纯文本模型（DeepSeek/GLM 等）加「看图」能力，粘贴图片返回结构化 JSON 证据（OCR + 版面 + 语义）。提供 `modlens_read_image` 工具、图片粘贴处理、`(modlens vision)` 模型变体与设置卡片。自带 `node_modules/{commander,undici}` 供它 spawn 的 CLI 使用；`config.families` 契约未变，`dsh.modlensFamilies` 覆盖层继续有效 |
| `dsh-mnemon` | [omdsh-dev/dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon) `0.5.45` | **三层记忆**（Runtime / Documents / Memory Spaces）。Starter + Source + Strategy + Provider 作为 sibling 包 transplant（0.5.45 的 sibling 集合含 `dsh-mnemon-source-skills`、`dsh-mnemon-strategy-general`）。**Mnemon Native** 使用 vsix 内置的 `@mnemon-dev/mnemon@0.2.8` win32-x64 二进制，宿主启动时设 `MNEMON_CLI_PATH`，**无需联网、无需全局装 CLI** |
| `@linxin666/dsh-ssh` | [linxin666/dsh-web](https://github.com/zhu1090093659/dsh-web) `0.4.18` | **SSH 远程（局域网/内网服务器）**：`ssh_list`/`ssh_exec`/`ssh_upload`/`ssh_download`/`ssh_tunnel`/`ssh_cluster` 模型工具 + 设置页主机配置 + Web 终端/SFTP。纯 JS（ssh2 + ws，无 native ABI）；`ssh2`/`asn1`/`bcrypt-pbkdf`/`tweetnacl`/`ws` 在 `_hostdeps`。0.4.18 声明 `engines.dsh >=0.2.2-rc.2`，client 设置改用 `ctx.configForms`。**仅出站连接**，不暴露宿主端口 |
| `@duke-dsh-plugins/dsh-git-manager` | [MoonlitDropOfBlood/dsh-git-manager](https://github.com/MoonlitDropOfBlood/dsh-git-manager) `1.7.0` | **Git 工作区管理**：输入框「模式」选择器旁入口（仅 git 仓库显示），居中面板提供 status/diff、分支管理、合并冲突解决、commit/fetch/pull/push、worktree 管理、带分支线图形的提交历史。纯 JS，走平台 Typert 协议；1.7.0 的 typert 调用带 0.2.2 严格校验要求的 `create()` schema 投影 |
| `dsh-archify` | [GongYuanCaiJi/dsh-archify](https://github.com/GongYuanCaiJi/dsh-archify) `0.1.0` | **架构图 Skill**（移植自 tt-a1i/archify）：用 JSON 规格生成可验证的架构图/流程图/时序图/数据流图/生命周期图。Skill-only bundle：零运行时依赖，`skills/` 目录由 `prepare` 脚本 staging（已内置），挂载平台 `@deepseek-ai/dsh-skill-filesystem` provider |
| `dsh-better-sidebar` | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) `0.32.1` | **服务化侧边栏工作台**：文件资源管理器 + CodeMirror 编辑器 + xterm 真实终端 + Git/本轮文件变动 + 内嵌浏览器 + 子代理与后台任务页，挂进 DSH **原生右侧栏**（`dsh-client-ui-sidebar-right`），并向其他插件开放 `ctx.betterSidebar`。0.32.1 针对 0.2.2 改写：peer 全部 `^0.2.2-rc.2`，宿主侧改用 `webStartup`/`ctx.settings` 新 API；client 半自包含。**取代已退役的 `dsh-code-ide`** |
| `@mlgbnb/dsh-archive-manager` | npm `@mlgbnb/dsh-archive-manager` `1.0.10` | **归档任务管理器**：设置页「归档任务」列表/恢复/删除，自行读取 `session(.vN).jsonl[.zstd]` 会话日志；client 注册平台 `settings.section` 槽位 |
| `dsh-zh-kit` | npm `dsh-zh-kit` `0.1.2` | **中文界面套件**：中文化文案与中文输入体验。一处本地修补：首步提醒消息的 source kind 改为 `plugin:${name}`（0.2.2 session format v4 拒绝 `kind:'plugin'`） |
| `@dsh-vscode/presets` | 本仓库生成（`.smoke/gen-presets.py`） | **内置 agent 预设打包层**：把 `plugins/presets/{router-standard,router-spec,ppt-master}` 转成 0.2.2 的 bundle 声明（`@deepseek-ai/dsh-agent-preset` 行）。预设里挂载的本地 ES 模块（`router-bootstrap-*.mjs`、`gitbash-executor.mjs`）作为 `dsh-preset-*` 真实包随附——预设的子行名是从 profile 解析的，相对路径不会被锚定到 patch 文件 |
| `_hostdeps/`（`@vscode/*`、`ssh2` 族、`zod`、`fflate`、`node-pty`、`schemastery`、`cosmokit`、`markdown-to-jsx`、`safer-buffer` 等 14 个包 / 13 个目录） | npm 包 | 各内置插件宿主侧所需的非平台依赖，内置以便离线解析（`dsh-mcp` 退役后其专属的 `@modelcontextprotocol/*`、`js-yaml` 及闭包已一并删除） |

> `dsh-mnemon` 的 source/strategy/provider 成员包与 `@dsh-vscode/presets` 挂载的 `dsh-preset-*` 模块包都以**兄弟包**形式放在 `plugins/bundled` 下（不在 `BUNDLED_PLUGINS` 里，由各 bundle 的 cordis patch 按裸包名认领），`.smoke/selfcontained-plugins.mjs` 会按「被 patch 认领」逐个校验；`_hostdeps/` 则是扁平化进 `<profile>/node_modules` 的第三方依赖。

> **`@liustack/modlens` 需要自己配一个视觉引擎才能读图**。它与平台几乎没有耦合（宿主半只 import node 内建，客户端半只 require `react` + `dsh-client-ui-primitives`，都来自前端共享表），并且**已经内置了 Electron 部署的处理**：它 spawn `process.execPath <dist/main.js>` 时显式设 `ELECTRON_RUN_AS_NODE=1`，所以用 VS Code 二进制当 Node 跑得通（实测 `--version` 正常）。
> 它的配置在 **`~/.modlens/config.json`**（不在 `DSH_HOME` 内，因此残留清理逻辑碰不到它）。装完先跑 `doctor` 看引擎状态，再按需配一条：`modlens config set gemini-api.apiKey`（免费、5-10 秒）、或把它指到任意 OpenAI 兼容的视觉端点：`modlens config set openai.baseUrl <url>` / `openai.apiKey` / `openai.model`。

**本分支的本地改造（相对上游）**

- **0.4.0：内置平台升级到 `@deepseek-ai/dsh@0.2.2-rc.2`**（原 0.1.5-rc.2）。要点：
  - `vendor/node_modules` 整体替换为 `@deepseek-ai/dsh@0.2.2-rc.2` + `@vscode/ripgrep@1.18.0` 的干净 hoisted 安装（`npm install` 到 staging 后整体替换，旧树备份在 git 历史里）。新平台闭包从 224 MB 变成 1.03 GB（新增 office/语音/computer-use/插件市场等 bundle，其中 `libreoffice-kit-*` 占 335 MB），`pack.py` 因此在打包时剔除两个非 Windows 的 wasm 回退包（`@deepseek-ai/libreoffice-kit-wasm`、`@img/sharp-wasm32`，见 `pack.py` 的 `PRUNE`），否则 vsix 会白涨 ~150 MB。
  - **插件兼容性闸门**（0.2.1-alpha.3 起）：宿主启动时按 `engines.dsh`（优先）或 `@deepseek-ai/dsh*` 的 peer 范围判断插件与运行时是否兼容，不匹配就**静默跳过**该 bundle。所有内置插件都已升到声明 0.2.x 兼容的版本（闸门全通过），`PLUGIN_VERSION_EXEMPTIONS` **为空**——只有「已验证但清单无法表达」的插件才允许往 `<profile>/compatibility.json` 写豁免；该机制保留但默认不授权，`.smoke/plugin-compat.mjs` 逐条断言。
  - **预设机制重写**：0.2.2 的预设 registry **不再扫描 `<DSH_HOME>/.agent-presets/`**，预设是 bundle patch 里 `@deepseek-ai/dsh-agent-preset` 的声明行。新增生成器 `.smoke/gen-presets.py` 把 `plugins/presets/*` 转成 `@dsh-vscode/presets` bundle；预设里挂载的本地 ES 模块打包成 `dsh-preset-*` 真实包（预设子行名从 profile 解析，相对路径不会被锚定）。预设内容同步迁移到 0.2.2：`persona.text`→`prefix`、删除 `{{cwd}}`、`workflow-worker-thread`→`workflow-ptc`、删掉已移除的 `tool-subagent-control/list-agents` 子路径、`modelSelectionSettings`→`modelSelection`、`tool-subagent-control` 加 `interrupt: false`。旧 `.agent-presets/` 里**只清理本扩展当年写的那三个 id**，用户自己的目录不动。
  - **插件整体刷新**：ssh 0.3.23→0.4.18、better-sidebar 0.19.1→0.32.1、git-manager 1.1.0→1.7.0、mnemon 0.5.8→0.5.45（sibling 集合更新）、modlens 3.26.1→3.27.3、auto-continue 0.11.5→0.19.0、live-compact 1.0.1→1.1.6、archive-manager→1.0.10；`dsh-undo-plugin` 由 `dsh-rewind-plugin@0.22.1` 取代；**`dsh-mcp` 退役**（见下）。详见下表。
  - **`dsh-mcp` 退役 → 平台官方 MCP 管理器接管**：0.2.2 自带 `@deepseek-ai/dsh-mcp-manager` + `dsh-mcp-client`，而 `dsh-mcp` 1.15.1 的 client 半也自行挂载同名（`mcpManager`）的 Remote contribution，**两个客户端挂载争用同一命名空间会把 client gateway 的串行挂载队列卡死**：面板永远停在「Loading plugins…」（40% 插件后定格）。这是浏览器侧死锁，纯宿主冒烟测试看不到，是靠 CDP 驱动真实浏览器才定位的（跳过那一处 `$mount` 即可完整启动）。故本版本把 `dsh-mcp` 移入 `RETIRED_PLUGINS`、随附目录删除，MCP 服务器改由官方管理器自带的设置表单管理。代价：失去旧插件的「MCP 管理页面 / OAuth / `mcp_tool_search` 热注入」，官方 README 把这些列为 Known Limitations。——详见 [`docs/upgrade/0.2.2-deltas.md`](docs/upgrade/0.2.2-deltas.md)。
  - **客户端 API 迁移**：0.2.2 删除 `ctx.settings.register`、`settingsScope`/`webUiSettings`、`ctx.layout.closeDetails`、`webRuntime` 服务；改为 `Config` 声明 + 客户端 `ctx.configForms`、`ctx.layout.closeDetails?.()`、`webStartup`。涉及插件已逐个移植（ssh/better-sidebar 走上游新版，web-review/zh-kit 打最小补丁）。
  - **会话格式 v4**：`source.kind: 'plugin'` 被拒，插件注入的消息必须写 `plugin:<包名>`（web-review、zh-kit 已改）；v0→v4 迁移链由平台负责，旧的 v0 容错补丁继续保留（只容忍、不修改原始文件）。
  - **平台补丁**：8 → 7 条（共 8 个文件，`dsh-app-boot` 一处改动涉及两个文件）。`dsh-subprocess-local`（`windowsHide`）与 `dsh-win32-process`（`STARTF_USESHOWWINDOW`）**上游已修复**，补丁删除但保留 `.smoke/windows-hide-test.mjs` 作为「上游不许回退」的守护；`dsh-session-persistence-jsonl` 的 `inspect(id)` 随 `@dsh-undo` 退役**移除**；新增**剪贴板 shim 补丁**（此前只存在于 vendor 树、不在补丁库里，升级会静默丢失）；新增 **`dsh-app-boot` 的 Electron 运行时可启动性补丁**（见下一条）。逐条裁决见 `.smoke/platform-patches/NOTES-0.2.2.md`。
  - **0.4.3 换掉压缩引擎：`dsh-live-compact` → `billion-context`**。`dsh-live-compact`（Spine 引擎）移入 `RETIRED_PLUGINS`、随附目录删除，旧 profile 的 `bundles` 与移植树在下次启动时清理；新内置 `billion-context@0.1.214`（MIT）走同一套 bundle 机制：它的 `dsh.bundle.patch.yml` 插入 `bili-native` 与常开的 `bili-compaction-gate`，把 `compaction-basic` 的 `auto` 关掉，并给 `preset-{standard,ptc,minimal,cordis}` 加 `inject: [biliBasicCompactionPolicy]`，让每个预设等 gate 注册完再装载。**顺序有要求**：patch 层只能改「前面层已声明的行」，所以 `BUNDLED_PLUGINS` 里 `billion-context` 必须排在 `@dsh-vscode/presets` 之后（当前是最后一项）。依赖落位也与其它插件不同：它把 `zod 4.6.7`（上游精确 pin）与 `mysql2` 闭包放在**自己的嵌套 `node_modules`** 里，而不是摊进 `_hostdeps`——`_hostdeps/zod` 是 4.6.4，摊平会互相遮蔽。验证：`check-hostdeps.py`、`selfcontained-plugins.mjs`、`boot-test.mjs`（含预设组装断言）、`ui-boot-test.mjs` 全绿，打包后 vsix 实测可启动。
  - **0.4.2 修复 SSH 插件静默丢失**：`@linxin666/dsh-ssh` 的宿主半经 `ssh2 → asn1` 需要 `safer-buffer`，而 `_hostdeps` 从来没随附它——0.1.5 时代它是靠 vendor 树里的副本碰巧解决的，0.2.2 的 vendor 闭包不再包含它，于是插件的 bundle 在装载时抛 `Cannot find module 'safer-buffer'` 并被静默跳过（SSH 面板消失，宿主本身照常启动）。已把它补进 `_hostdeps`（2.1.2, MIT），并新增 `.smoke/check-hostdeps.py`：遍历 `_hostdeps/**` 与每个内置插件声明的 `dependencies`，逐个核对能否从 `_hostdeps` / vendor 闭包 / 自身嵌套 `node_modules` / 其它随附 sibling 包解析，解析不到就失败——这类「只在打包后才炸」的漏依赖以后过不了门禁。
  - **0.4.1 修复「装进 VS Code 就打不开」**：0.2.2 的 `dsh-app-boot` 通过 `node-addon-require-builtin` 这个原生 addon 取 Node 内部模块，而该 addon 按**精确的 Electron 版本白名单**（0.2.2 只有 43.0.0 / 44.0.0 / 44.7.0 / 45.0.0-alpha.6）做嵌入环境指纹校验。扩展把宿主跑在 **VS Code 自带的二进制**上（`ELECTRON_RUN_AS_NODE=1`，VS Code 1.144.1 = Electron 43.8.3），不在白名单里，于是 addon 返回 `Unsupported/no-context`，宿主在准备阶段直接退出 1：
    ```
    dsh: host preparation failed: node-addon-require-builtin unsupported:
    Unsupported/no-context (unsupported Electron runtime fingerprint: Node 24.22.1, V8 15.0.245.31-electron.0)
    ```
    用 `node.exe` 跑永远不会触发，所以此前的全部冒烟测试都是绿的。修法沿用平台自己的约定（`cordis-plugin-loader`、`dsh-hmr` 都是这么写的）：**先走 `--expose-internals` 原生路径，addon 只作兜底**，两条都失败时报出两边原因。扩展本来就总是给宿主加 `--expose-internals`，因此原生路径可用（实测 `internal/modules/esm/{loader,utils,resolve}` 与 `cjs/loader`、`helpers` 暴露的接口与 addon 一致）。补丁落位 `.smoke/platform-patches/dsh-app-boot/`，重打 vendor 时用 `python .smoke/patch-app-boot-internals.py apply`；守护测试：`boot-test.mjs --electron`、`ui-boot-test.mjs`。
  - **兼容性验证**：`.smoke/boot-test.mjs` 现在还会向宿主查询预设名单（Typert Remote `agentPresets/list`）并断言每个预设都能组装（`broken` 为空），因为 0.2.2 会把失败的预设**留在名单里**而不是启动失败；另加 `--electron` 用 VS Code 自带的 `Code.exe`（`ELECTRON_RUN_AS_NODE=1`）起宿主，**复现真实安装环境**——这条路径与 `node.exe` 行为不同，上面那个 addon 缺陷正是只有它能复现。
- **移除 `@dsh-vscode/p2h-bridge`，换装 `dsh-ppt-master` + `dsh-live-compact`**：p2h-bridge（本仓库自研的 PPT↔HTML 桥）从 `BUNDLED_PLUGINS` 摘掉、列入 `RETIRED_PLUGINS`（启动时从旧 profile 的 `bundles` 与 `node_modules` 清理），`plugins/bundled/@dsh-vscode/p2h-bridge` 与其 38 个专属 `_hostdeps` 依赖（docgen-utils、fontkit、jszip、linkedom 及闭包，经反向依赖闭包计算确认无他用）一并删除，专属 smoke 测试 `.smoke/p2h-manager-test.mjs` 移除。新装两个零运行时依赖插件：**`dsh-ppt-master@1.0.8`**（PPT 大师预设 + 两个 PPT 技能）与 **`dsh-live-compact`**（Spine 压缩引擎，扩展 compaction-basic）。0.2.2 上二者的预设/兼容处理见上一节。
- **自定义模型「支持图像 / 推理模型」开关**（explore.24，**0.2.2 已上游化**）：0.1.5 时给 `dsh-client-ui-settings-models` 打了补丁；0.2.2 原生提供 `ModelInputTypes`（text/image）与 `ModelReasoningEfforts`（低/高/最高）编辑，模型选择器对声明 reasoning 的模型显示 **Default / Low / High / Max**。因此该补丁**不再重新移植**（重复添加会出现两套控件）；唯一未复刻的是旧版「切换即持久化」的交互（0.2.2 走卡片 Apply）。
- **移除 `dsh-code-ide`，由 `dsh-better-sidebar` 取代**（explore.84）：两者覆盖同一片「编辑器 + 终端 + 资源管理器 + 工作区搜索」的表面，同时存在会争夺右侧栏，且 dsh-code-ide 把 CodeMirror/xterm 的重复负载又带进 vsix 一份。改为把 `dsh-code-ide` 从 `BUNDLED_PLUGINS` 摘掉、列入 `RETIRED_PLUGINS`（启动时从旧 profile 的 `bundles` 与 `node_modules` 清理），并删除 `plugins/bundled/dsh-code-ide` 与其专属依赖 `_hostdeps/ffi-rs`（`node-pty`/`@vscode/ripgrep` 保留——前者是 better-sidebar 的宿主依赖）。它此前在 0.1.5-rc.2 上的三处适配（client 的 slot props/`baselinesReady`、host 的 `X-Frame-Options`、`ffi-rs` 的 mutation backend）随之归档；相关根因分析仍留在 git 历史里，需要时可 `git log -p -- plugins/bundled/dsh-code-ide` 取回。
- **宿主移植的「静默半成品」缺陷修复**（explore.83）：装上带新内置插件的 vsix 后宿主启动即 `cannot resolve profile bundle "dsh-better-sidebar"` 并 exit 1、面板全白。根因不在插件：`syncBakedPlugins` 会把名字写进 profile 的 `bundles`，而移植那一步的每次拷贝都包在 `catch { /* skip */ }` 里**静默吞错**，标记文件却**无条件写入**——于是一次瞬时拷贝失败（pnpm/vendor 刚写完、杀软正在扫那个 14 MB 新包之类）被固化成「已移植」，fast path 又只比对版本+内容摘要、**从不校验包目录是否存在**，从此每次都跳过移植，profile 永久无法启动。修法：新增 `missingBundledPackages()` 并纳入 fast path 条件（只要有 entry 目录缺失就强制重跑移植），三处拷贝改为收集失败项并新增 `baked-in transplant INCOMPLETE: …` / `baked-in transplant re-running: …` 两行可见上报。验证：从源码提取该函数对真实文件系统跑四组用例（完整=0 缺失；挪走 better-sidebar=正确检出；挪走 `_hostdeps` 依赖=不计入；还原=干净）。
- **内置 `dsh-better-sidebar`**（explore.82）：把插件包整体放进 `plugins/bundled/` 并加入 `BUNDLED_PLUGINS`。依赖账：client 半零裸导入（自包含），host 半只需 `ws`/`schemastery`/5 个 `@deepseek-ai/dsh-*`——前两者已在 `_hostdeps`（`dsh-mnemon` 同样按裸名解析 `schemastery`），后五者由 vendor 闭包按**运行宿主的同版本**提供，因此 `_hostdeps` 与 `vendor` 一行未动。验证：`.smoke/boot-test.mjs` 13/13（该 harness 直接从 `src/extension.js` 读 `BUNDLED_PLUGINS`，不会与发货内容漂移）。
- **复制功能整体失效修复**（explore.74，0.2.2 起纳入补丁库）：webview 里所有复制按钮（消息复制、记忆空间复制 ID 等）静默失败。根因：VS Code webview 的**跨源 iframe**（`vscode-webview://` 嵌入 `http://127.0.0.1:*`）里 `navigator.clipboard.writeText` 被 permissions-policy 拦截抛 `NotAllowedError`，而平台 `Rn` helper 与各插件均无 fallback。修法：在宿主服务的 SPA 入口 `vendor/.../dsh-web-frontend/dist/index.html` 注入 shim，覆盖 `navigator.clipboard.writeText`——先在用户手势内**同步**尝试不受 policy 限制的 `document.execCommand('copy')`（textarea 中转），成功即返回；失败再走原生 API。一处修复覆盖平台与**全部现有及未来插件**。0.2.2 没有修（它只给自己的 helper 加了兜底，`dsh-mnemon` 等仍直接调 `navigator.clipboard`），所以升到 0.2.2 后这处 shim **必须保留**，现已作为 `.smoke/platform-patches/` 的第 7 条补丁（`pack.py` 打包前字节校验，丢了就拒绝打包）。验证：宿主启动后 `GET /` 返回的 HTML 含 shim。
- **代理同源 Origin/Referer 转发修复**（explore.74）：网页预览报「页面无法通过隔离预览加载」，日志 `proxy 403 POST /webview-preview-sessions`。根因：扩展代理的 `STRIPPED_REQUEST_HEADERS` **无条件剥离** `origin`/`referer`，而 `dsh-web-review` 的 `previewSessionsHandler` 用 `requestOrigin()` **强制要求同源 Origin**，缺 Origin → 403。修法：`forwardToHost()` 改为对**同源**（host 等于 `appAuthority`）的 Origin/Referer 放行转发，跨源的仍剥离——DSH 的 Host/Origin fence（`sec-fetch-site: cross-site` 硬拒）与 web-review 的校验均通过，浏览器标记不再被误伤。验证：直连宿主 `POST /webview-preview-sessions` 无 Origin 仍 403、带同源 Origin 返回 201。
- **撤回支持压缩后被摘除的消息**（`dsh-rewind-plugin`，explore.75）：压缩（compaction）会把旧消息从**模型上下文表面**摘除——摘要节点用 `surfaceOp: replace` 覆盖一段范围，旧消息只留在会话日志里。此前撤回这些消息（点历史消息下的撤回按钮）直接报 `user message at seq N is no longer in the model context (shadowed by compaction)`。这其实不合理：撤回的语义是"放弃目标之后的内容"，而目标**是否还在模型上下文里**与"它之后的内容要不要放弃"无关。修法：`planRewind` 在目标不在 surface 时，沿 surface **从后往前**找覆盖它的节点（`sourceEventSeqs` 含目标 seq；`SurfaceOp replace` 契约保证摘要节点引用每一个被它 shadow 的节点），从该节点起连同后续全部摘除——与正常撤回完全同一条 `surfaceOp: replace` 路径，会话日志始终保留。找不到覆盖节点时才保留报错（真实折叠下不会发生）。验证：`.smoke/rewind-compaction-test.mjs` 白盒提取真实 `planRewind` 函数体，10/10 通过（含正常路径回归）。
- **「打开预览」跳转到「网页预览」标签页 + 预览内容在 webview 内真正可达**（`dsh-web-review` + `p2h-bridge` + `src/extension.js`，explore.76）：此前 PPT「打开预览」只在本面板内联 iframe 展示，从不驱动 web-review 的「网页预览」标签页；且即便驱动成功，web-review 隔离预览服务器监听**临时端口**（`server.listen(0)`），frameUrl 形如 `http://<id>.localhost:<临时端口>/.dsh-web-review/entry/...`——而 VS Code webview 的 portMapping 只映射扩展代理固定端口（37750），临时端口在 webview 内不可达，于是显示「页面无法通过隔离预览加载」。三层修复：① **loopback 走公共端口**（`dsh-web-review` host）：`createSession` 对落在**应用自身公共端口**上的 `127.0.0.1`/`localhost` 目标（如 p2h 的 `http://127.0.0.1:37750/p2h-bridge/decks/...`）返回**路由 descriptor**——与公共 origin 同源、会话 id 放进路径 `/.dsh-web-review-frame/<id>/.dsh-web-review/entry/...`，隔离包装与批注 bridge 全部保留（由宿主 `ctx.webServer` 前缀路由承载，公共端口取自 `publicFramePortOf()`：VS Code 用 `DSH_PROXY_PORT`，桌面用宿主自身端口）；其它 loopback 端口（第三方 dev server）仍走**直连 descriptor**，避免把外来本地服务抬到 DSH surface 的 origin 上；外部网址仍走隔离预览（回归已验证）。② **跨插件驱动通道**（`dsh-web-review` client）：web-review 0.6.0 的 `openPreview` 是 `conversation.input.dock` 注入的私有能力，其他插件够不着——现发布全局 `window.__dshWebReviewOpenPreview__(url)`（设 webviewStore URL + 激活「网页预览」标签页），WebviewView 只对**未包装的直连** descriptor（frameUrl 不带 entry/路由前缀）跳过 bridge 握手（否则 15s 后误报「页面无法通过隔离预览加载」）；路由/隔离 frame 一律照常握手——元素框选与批注依赖它。**关键点：引擎（store 实例）改由插件自有的 per-session 注册表持有**，照搬本仓库 `main` 分支的现成实现：`createWebviewStoreRegistry(handle)` 提供 `instanceFor(sessionId)`（惰性 `handle.create(sessionId)` + Map 缓存）、`prune`/`pruneAbsent(liveIds)`，配合 `ctx.sessions.list.subscribe` 做会话回收。两个 `slots.register` **不再声明 `store:`**，改由注入面返回 `hooks: { webviewStore: engine }` + `actions: engine.actions`（`WebviewView`/`DraftOverlayBar` 相应改吃 `useWebviewStore`）——若保留 `store:`，renderer 会经由它私有的 store 轴再建一个实例，同一会话出现两个引擎，opener 写入的那个组件观察不到。全局 opener 则按 `ctx.sessions.list.getSnapshot().current` 取当前会话的引擎即时写入。**为什么不能沿用「捕获 renderer actions」的写法**：`conversation.view` 视图区只渲染激活项（`renderSlot(..., { only: active.id })`），且 `cachedSessionInject` 按 (entry × binding) 记忆化 → 在从未打开过「网页预览」标签页的会话里 dock/view 的 inject 根本没跑过，被捕获的 action 不存在，opener 只能返回 false；`instanceFor` 则按需铸造。③ **预览 URL 端口**（`p2h-bridge` + 扩展）：p2h 的 `ctxPort()` 原本取 `ctx.webServer.port`（宿主 OS 分配临时端口，webview 不可达），现优先读扩展注入的 `DSH_PROXY_PORT`（= `hostPortFor()`，37750）；扩展 `startHost` 的 env 注入该变量。p2h「打开预览」按钮优先调用全局 opener，失败才回退内联预览/新窗口。验证：`.smoke/direct-preview-test.mjs`（loopback→路由 201、外部→隔离 201、客户端含全局 opener 与路由/直连分支、per-session 引擎注册表两个注册以 `hooks`/`actions` 下发引擎、p2h 接线、p2h routes 优先 `DSH_PROXY_PORT`）。
- **PPT 预览「能打开但无法添加注释」+ 删除 deck 报 `ENOTEMPTY` + 修复为何迟迟不生效**（2026-09-18 修复轮；其中 ① 取代上一条的 loopback 直连）：① **批注失效**：直连 descriptor 让 `WebviewView` 跳过 `PreviewBridgeClient` 握手（没有隔离包装就没有 bridge），于是 `pickerReady` 永远为 false，元素框选/添加注释整条链不可用——预览能显示、就是点不动。现改为**路由 frame**（见上一条 ①）：loopback 目标照常过隔离包装（parse5 重写 + bridge 注入 + 路由前缀），只有第三方 loopback 端口保留直连。实测 9.06 MiB / 1.6 万段落的 deck 页面重写 ~0.63s（热 ~0.52s），bridge 配置与脚本正常注入。② **`deck.project.previewUrl` 读错字段**（`p2h-bridge` client）：`/p2h-bridge/api/state` 把 `previewUrl` 放在 deck 上，`project` 只是清单摘要（slideCount/importedAt/sourceName），于是全局 opener 从来没被调用，「打开预览」静默退化成 `setActive` + 刷新内联预览——正是「没响应，只是刷新了当前预览」；「新窗口」按钮因同一 undefined 根本不渲染，体积徽标同理读了 `bytes`（接口给 `size`）。修法：`deckPreviewUrl(deck)` 统一取 `deck.previewUrl`（保留 `project` 嵌套做前向兼容）、`size` 修正、「新窗口」直开系统浏览器不再绕 opener。③ **删除 deck 报 `ENOTEMPTY`**：`fs.rmSync(dir, {recursive:true})` 的 `maxRetries` 默认 0，预览传输/索引器/杀软持有子文件句柄时该条目进入 Windows「删除挂起」状态（`statSync` 可读、`readFileSync` EPERM、`existsSync` false、`readdir` 仍列出），父目录 rmdir 报 ENOTEMPTY，而 Node 只报**顶层**路径（`\\?\...\.ppt\CSSA`）不说是谁卡住。新增 `lib/remove-tree.mjs`：按 80→900ms 退避重试 ENOTEMPTY/EBUSY/EPERM/EACCES、清理只读属性、回退 `rd /s /q`，仍失败则返回 409 + 残留项清单；`serveStatic` 在响应关闭时立即 `stream.destroy()`（不再留句柄把 deck 变成永久删除挂起）；`slides/import.mjs` 重转同路径。④ **为什么前几轮修复不生效**：`transplantBundledPlugins` 的快路径只比对**版本号**，而开发循环反复重打包同一个 `0.3.0-explore.76`、插件版本也一直 `0.3.0` → 标记永远有效，profile 里跑的始终是旧 bundle（日志 `transplant skipped (73 packages)`；profile 内 client.js 停在 19:48，仓库/已安装扩展已是 21:12）。现指纹改为「版本号 + 每文件 size/mtime 摘要」（30 个 bundle 实测 23ms，仍避免每次启动拷贝 64MB）。验证：`.smoke/direct-preview-test.mjs` 19/19、`.smoke/p2h-manager-test.mjs` 19/19（真渲染组件点击按钮断言 opener 收到 URL；真实 HTTP 服务上跑删除/预览路由）、真实 Chromium A/B（直连 frame 0 条 bridge 消息 vs 路由 frame 1 条 `frame-to-host` 握手，origin/channel 全对）。
- **PPT 的 `.ppt/` 跟随「当前会话工作区」+ agent 命令不再闪控制台**（2026-09-18/19，`p2h-bridge` + `dsh-win32-process` 平台补丁）：① **`.ppt/` 路径**：p2h 一直用 `process.cwd()` 当工作区根，而宿主的启动目录只是「扩展/桌面应用打开的那个文件夹」——会话自己带 `session.header.cwd`（同一宿主里开在别的项目上的会话，cwd 是那个项目），于是 deck 被写进了宿主启动目录（dsh-vscode）而不是当前工作区。现改为 `AsyncLocalStorage` 承载「本次执行的工作区」：HTTP 路由从 `?session=<id>` 取会话、`ctx.agents.get(id).session.header.cwd` 解析（与 fs 工具、dsh-mnemon 同一取值口径，取不到才回退 `process.cwd()`），工具侧直接吃 `exec.agent.session.header.cwd`（`agent.id` 即 sessionId，一并带上以便 previewUrl 仍指向同一棵树）；预览 URL 带 `?session=`，预览路由据此解析同一工作区（frame 被 webview/web-review 隔离服务重新抓取时没有别的上下文）。并发会话互不可见（ALS 按执行域隔离），`withWorkspaceRoot()` 的 root 与 session 同时生效。② **控制台闪窗**：靠**运行时追踪**（在已安装扩展加载的那份平台代码里临时插桩，记录 `subprocess.spawn` 选了哪条路、以及每次 `CreateProcess*` 的真实 flags）把「命令执行时闪一个终端窗口」钉到具体进程创建。一条 `powershell -NoProfile -Command "echo hi"` 只产生 4 次创建：`subprocess.spawn mode="windows-job"`（沙箱开启：`--mode workspace-write` + write SIDs）→ `win32.ordinary flags=134218756`（沙箱 runner，隐藏）→ `win32.ordinary flags=134218756`（工具外壳 powershell，隐藏）→ **`win32.restricted flags=4`**（受限令牌子进程）。根因有**两层**：① explore.27 只给 `launchWindowsJob`（runner 自身）补了 `windowsHide`、explore.58 只给**普通路径的目标创建**补了 `CREATE_NO_WINDOW`，**受限令牌那两个调用点从来没被补过**——它们只传 `CREATE_SUSPENDED`，靠**继承**调用者的控制台；而 VS Code 宿主是 Electron/`Code.exe`（GUI 子系统，`CREATE_NO_WINDOW`/`windowsHide` 对它**无效**），沙箱 runner 因此没有控制台可继承，Windows 就给受限子进程**现开一个可见控制台**。② 更精确地说，那句创建里的 `STARTUPINFOW` 是 `dwFlags: 256`（仅 `STARTF_USESTDHANDLES`）——**紧挨着的 `wShowWindow: 0` 因此完全无效**（Windows 只在 `dwFlags` 含 `STARTF_USESHOWWINDOW` 时才看 `wShowWindow`）。修法：两个 `STARTUPINFOW` 站点都置 `dwFlags: 257`（`256 | STARTF_USESHOWWINDOW`）并给 piped 站点补 `wShowWindow: 0`，即 **`SW_HIDE`：控制台照旧存在、只是从不显示**。**故意不用 `CREATE_NO_WINDOW`**：DSH 维护者验证过受限令牌下它会让子进程 `STATUS_DLL_INIT_FAILED`（`0xC0000142`）——本机一次 workspace-write 实测确实能过（exit 0、stdout 正常、无窗口），但这正是那种"在别人机器上炸"的隐患，**命令直接失败比闪一下更糟**。顺带补掉同类缺口：一次性 windows-acl 能力探测的 `spawnSync`（`dsh-sandbox-local`）缺 `windowsHide`（`dsh-subprocess-local` 里的两处 `taskkill` 本仓库已有）。验证：`.smoke/windows-hide-test.mjs` 现在既断言形状（两处 `dwFlags: 257`、两处 `wShowWindow: 0`、无残留 `dwFlags: 256`、受限调用点**不得**出现 `CREATE_NO_WINDOW`），又**真跑一条 workspace-write 受限命令**并断言：exit 0、stdout 完整、**没有新可见窗口 / 没有新控制台宿主进程**。

  > **与社区插件 [`dsh-silent-pwsh`](https://github.com/chengyimingvb/dsh-silent-pwsh) 的关系（同根因、两个层面）**：它做的事与本轮 ② 的最终修法**完全一致**——同样把 `dwFlags: 256 → 257` + `wShowWindow: 0`，同样明确拒绝 `CREATE_NO_WINDOW`（引用维护者的 `0xC0000142` 结论），并同样补了 taskkill 与能力探测两处 `windowsHide`（前者本仓库早已有，后者本轮补上）。差异有三点：**(a) 分发方式**——它是"自愈式补丁插件"，宿主每次启动时对**已安装应用**的 `host/node_modules` 幂等重打补丁（面向无法自行重打包的用户）；本仓库是构建期补丁（打进自己的 vsix + `.smoke/platform-patches` 清单 + `pack.py` 打包前 `verify` 字节比对 + 上面的行为回归测试），升级即随包走、无需运行期改写。**(b) 覆盖面**——它只解决闪窗这一类；本仓库另外还修了 `.ppt/` 随会话工作区、deck 删除 `ENOTEMPTY`、预览标签页驱动与批注握手、路由 frame 的 `frame-ancestors`、移植指纹失效、mnemon 三处 `windowsHide` 等。**(c) 定位方式**——它是先验地照上游缺陷打补丁；本仓库是靠运行时追踪拿到"你的命令最后一次创建就是 `flags=4`"这条证据才定案的。上游侧其实已经有修好的 chunk 没被入口引用（它 README 也提到这点），这才是根治点。
③ `.smoke/p2h-manager-test.mjs` 扩到 25 项：新增「会话作用域的请求只看到该会话的 deck」「previewUrl 带 session」「会话作用域的预览路由能取到该会话的 slides」「该会话上传落在它自己的工作区」「删除也只动它的树」。
- **路由 frame 的 `frame-ancestors` 必须省略（否则预览空白）**（`dsh-web-review` host，2026-09-18 续修）：把 loopback 预览改成路由 frame 后，标签页变成空白并报「页面无法通过隔离预览加载，请检查网址或目标站点」，控制台为 `Framing 'http://127.0.0.1:37750/' violates … "frame-ancestors http://127.0.0.1:37750"`。根因：隔离 handler 给每个 HTML 响应加了 `frame-ancestors <parentOrigin>`，而 **VS Code webview 的祖先链里永远有一个 `vscode-webview://…` 文档**，`frame-ancestors` 校验**所有祖先**（不只直接父级），于是只要指令里没列这个 scheme 就必然被拦——直连 frame 之前能显示，正因为它压根没有 CSP。修法：`frameAncestorsHeaders(session)`/`handoffCspHeaders(session)` 只对**真正隔离**的 `<id>.localhost` 会话保留该指令（桌面端仍生效、外部网址语义不变），路由 frame 只带 `default-src 'none'; script-src 'unsafe-inline'`（会话 id 是 128 位随机、内容本身就是本应用自己的），并顺手修掉「新窗口」按钮：webview 沙箱拒绝弹窗（控制台 `Blocked opening … in a sandboxed frame whose 'allow-popups' permission is not set`），现 `window.open` 被拒时回退到「网页预览」标签页而不是静默失败。验证：Chromium 三层嵌套（第三方 origin → 应用 shell → 路由 frame）A/B——修前 `frame-ancestors` violation 且 frame 未渲染，修后无 violation 且 frame 自身执行上下文返回 `DECK LOADED`；`.smoke/direct-preview-test.mjs` 增加「路由 frame 不带 frame-ancestors / 隔离会话仍带」两条断言。
- `@dsh-vscode/p2h-bridge` 0.2.1 → 0.3.0：原本是挂在 `dsh-better-sidebar` 标签栏里的侧边栏标签页，现改为注册平台官方 slot `conversation.view`（`order: 15`），**紧邻「轨迹」标签页右侧**；同时移除对 `betterSidebar` 服务的全部探测与 web-review 预览标签页的外部驱动（web-review 0.6.0 已不再提供该公开 API），预览改为面板内联 iframe + 「新窗口」兜底。调研与 0.1.1→0.1.5 API 差异见 `docs/superpowers/specs/2026-09-01-p2h-bridge-conversation-view-tab-research.md`。
- ~~`@dsh-undo/rollback-fork` 平台导出缺失~~（**已随 `dsh-undo` 退役**）：0.1.1-rc.2 之后上游删除了 `@deepseek-ai/dsh-agent-presets` 的 `resolveSessionPreset` 导出，当时把旧实现内联回来才让宿主启动。0.2.2 起回退功能由 `dsh-rewind-plugin` 提供，该成员包不再随附；`platform-api-scan.mjs` 仍用于一次性扫出这类平台导出断裂。
- `@canglongcl/dsh-web-review` 的 `storeAnnotationSnapshot` + 客户端清除路径：**批注同步/清除不应因「无 live agent」或「宿主短暂不可达」报「注释上下文同步失败」**。上游把 pending 绑在 `agents.get(sessionId)` 上，取不到 live agent 就 **404 `session not found`**；且客户端只容忍「清除 + 404」，宿主重启/被 SIGTERM 时的网络错误或 502 会让 dock 卡在「正在清除注释 / 同步失败」。批注本质上只是「下一轮 user message 的历史上下文」：已改为 **pending 按 sessionId 存**（`agent.id` 就是 sessionId），空/非空草稿在无 agent 时都可写入；注入仍走 `agent/pre-step`；**不再**在 `agent/disposed` 时丢掉未注入草稿。客户端：**空草稿（清除）在任何 fetch 失败/非 2xx/非法回执时都视为成功**（浏览器已丢掉 picks，宿主 pending 本就随进程消失），非空路径的错误上报原样保留。已验证与扩展代理无关：同一请求直连宿主与经代理返回完全一致。
- **已移除 `dsh-memory-evolve`**（explore.17）：切会话时 Advisor 面板对无 live agent 的 sessionId 连打 `status/instructions/scopes/events`（全部 400），并疑似与宿主异常退出相关。已从 `BUNDLED_PLUGINS` 摘掉、列入 `RETIRED_PLUGINS`（启动时从 profile `bundles` 与 `node_modules` 清理），插件目录不再打包。
- **宿主意外退出后自动恢复**（`src/extension.js`）：宿主被 SIGTERM（窗口重载、扩展宿主回收、`DSH: Restart` 等）后，旧代码只尝试改写 `webview.html`——而 VS Code 对**已渲染**的 view 改 html **不会重绘**（见 `resolveWebviewView` 注释），于是旧 iframe 留在原地，技能等面板的 `fetch` 全部变成 `Failed to fetch`。现改为：非 shutdown 退出时自动 `ensureHost()` 并 `postMessage` 让 shell 重载 iframe（与 `restartHost` 同路径）；3 秒冷却防止崩溃循环；连续失败才退回错误页。
- **执行命令时不再弹出命令行窗口**（explore.27/58 的 `dsh-subprocess-local` + `dsh-win32-process` 平台补丁，**0.2.2 已上游修复，补丁删除**）：Windows 上跑普通命令走的是 `launchWindowsJob`，它 spawn 托管 job runner 时**漏了 `windowsHide`**，于是 Windows 给 runner 分配一个控制台 → **命令开始时弹窗、结束时消失**；受限令牌路径的 `STARTUPINFOW` 则只置 `STARTF_USESTDHANDLES`，紧挨着的 `wShowWindow: 0` 因此完全无效。0.2.2 的 `launchWindowsJob` 已带 `windowsHide: true`，两个 `STARTUPINFOW` 站点也都改成 `dwFlags: 257` + `wShowWindow: 0`（SW_HIDE，且没有用有 `0xC0000142` 风险的 `CREATE_NO_WINDOW`）。补丁不再需要，但 `.smoke/windows-hide-test.mjs` 保留并改为**断言上游修复仍在**（源码三段 + 机制 + 真跑一条受限命令），防止未来平台升级把它带回来；本仓库仅剩 `dsh-sandbox-local` 的能力探测 `windowsHide` 补丁。
  > 这个调用点靠「grep `spawn(`」是**找不到**的——它写作 `(internals.spawn ?? spawn)(`，`spawn` 后面跟的是 `)`；而「这个文件里有没有 `windowsHide`」也会漏，因为**同一个包里 `runner-launch` 的 taskkill 调用确实设了**。我是把全树每个 `child_process` 调用点的**参数对象**逐一审出来才定位到的。
- **斜杠指令恢复显示**（`@canglongcl/dsh-web-review` 客户端半边，本地补丁）：打出 `/` 时**只列出技能、指令全不见**（`/goal`、`/compact`、`/model`…）。原因是 0.1.5 的客户端用
  ```js
  rows.push({ name: contribution.name, description: contribution.description() })
  ```
  构造菜单——**它把 `description` 当函数调用**，所以贡献必须给它一个 thunk（平台自己写的是 `description: () => t("command.description")`）。而 web-review 是按**旧版客户端**写的（那时接受字符串），传的是 `description: t("command.skills.description")`，于是抛 `TypeError: contribution.description is not a function`。因为这个候选构造是**一个函数**，异常会让**整个指令源**失败——症状不是「少了一条指令」，而是**一条都没有**，只剩技能。补丁把它改成 thunk（顺带让描述能跟随语言切换重新翻译）。新测试 `.smoke/client-command-shape.mjs` 扫描 `plugins/bundled` 里**所有客户端包**（认 `__ModuleLoader__` 标记，因此主机侧用字符串的 `@dsh-undo` 不会被误判）并断言每处注册的 `description` 都是函数。
- ~~归档任务恢复可读~~（**0.2.2 起退役**）：0.1.5 时代设置页「归档任务」报 `this.ctx.sessionPersistence.inspect is not a function`，当时给 `dsh-session-persistence-jsonl` 补了 `inspect(id)`。0.2.2 上唯一的调用方 `@dsh-undo/*` 已随插件退役，现在的 `@mlgbnb/dsh-archive-manager` 自己读取 `session(.vN).jsonl[.zstd]`，`dsh-better-sidebar` 用 `open(id,'read')`，**没有任何调用方**——补丁与守护测试已一并移除（回归：`.smoke/platform-patches/NOTES-0.2.2.md` 记录理由与证据）；包本身回到与干净 0.2.2 字节一致。
  > 顺带记一条踩过的坑：`sessionPersistence.inspect` 这类**客户端与服务端的契约错配**，错误信息只会出现在**浏览器控制台**，不会进宿主日志。所以「宿主日志里什么都没有」根本不能证明插件没出问题。
- **「打开配置文件」内嵌桥接恢复**（`@deepseek-ai/dsh-api-settings-controller`，见 `.smoke/platform-patches/`）：0.1.1 时这个职责在 `dsh-host-apiproxy` 里——`DSH_EMBEDDED=1` 时把设置文档路径打到 stdout（`[dsh-vscode:open-settings] <path>`），由扩展在 VS Code 编辑器里打开，因为**内嵌部署下原生打开器用户根本看不见**。0.1.5 删掉了 `dsh-host-apiproxy`，设置职责搬到 `dsh-api-settings-controller`，而那里的 `openSettingsDocument` **无条件**调用 `openTextFile`：环境变量判断和哨兵都没了，也没有 `openAgentPresetDirectory` 那样的「返回路径」分支。0.1.5 全平台**不再读取 `DSH_EMBEDDED`**（仅剩 `DSH_AGENTS_HOME`、`DSH_BUNDLED_SKILL_DIR`、`DSH_TELEMETRY_DISABLED`、`DSH_WEB_FETCH_PROVIDER`、`DSH_WEB_SEARCH_PROVIDER`），没有官方接缝可用——于是面板里点「打开配置文件」**毫无反应**。已在接手同一职责的 handler 里恢复该分支，并保留 `internals.openTextFile` 接缝（`.smoke/embedded-open-settings-test.mjs` 用桩驱动真实 controller，验证开/不开 `DSH_EMBEDDED` 两种路径）。
- **会话格式迁移的插件兼容层**（`@deepseek-ai/dsh-session-format-v0-to-v1`，见 `.smoke/platform-patches/`）：0.1.5 引入了会话格式版本化，v0→v1 迁移对「已发布 v0 规格」之外的内容**一律拒绝**，且一个事件不合格就让整个会话无法读取。而**第三方插件当年往 v0 会话里写了不少规格外内容**，于是升级后旧历史打不开。已加入四类容错（各自只记录一次日志，原始 v0 文件永不修改）：丢掉内容块上的插件注解（`dsh-file-review` 的 `dshFileReview`）、丢掉插件 source 上的多余成员（`dsh-web-review` 的 `snapshotId`）、丢掉非 `notice` 形式下多余的 `summary`（`dsh-mnemon`）、把 `subagent/descriptor` 的低版本视为可接受（0.2.2 已原生接受 v1/2/3，因此该条容错**已删除**）。0.2.2 新增了 v3→v4 迁移层（`dsh-session-format-v3-to-v4`），本次补丁只作用于 v0→v1 这一层，两者互不影响。实测某份 30 会话的真实历史：修复前 **21 个会话、1251 个事件被拒**，修复后 **0**。容错时会打印形如 `[dsh-session-format-v0-to-v1] note: tolerated plugin-authored v0 data: dropped member "dshFileReview"` 的提示——**这是通报不是报错**（会话照常加载，只是丢弃了某个插件加进去的字段），每种形状只打一次，且走 stdout 所以不会显示成 `[host-err]`。用 `.smoke/session-history-check.mjs <DSH_HOME>` 复检（0.2.2 起日志名是 `session.v<N>.jsonl.zstd`，脚本只校验尚未迁移的 v0 文件）。
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
- Python 3（用于打包脚本与预设生成）
- 无需 Node.js/npm 打包：构建产物由本仓库已提交的 `vendor/` 与 `plugins/bundled/` 直接打包
- 只有**升平台**（重建 `vendor/`）或跑冒烟测试时才需要 Node.js ≥ 24.9 与 npm（0.2.2 的 `engines` 要求）。运行时不需要：宿主用 VS Code 自带的 Electron Node 跑（`ELECTRON_RUN_AS_NODE=1`），Node 24 这条 `engines` 在进程内并不强制校验——属于「能跑但非官方支持」的边界，升级平台时值得复核

### 仓库结构

```
dsh-vscode/
├── vendor/            # DSH 宿主平台依赖树（已提交，构建时整体打包）
├── plugins/
│   ├── bundled/       # 内置生态插件（自包含，含 _hostdeps 宿主依赖）
│   │   └── @dsh-vscode/presets/  # 生成物：0.2.2 预设 bundle（.smoke/gen-presets.py）
│   ├── presets/       # 预设源文件（router-standard / router-spec / ppt-master，不随包发布）
│   └── node_modules/  # 插件扁平安装树（仅本地生成用，不入库）
├── docs/upgrade/      # 平台升级的破坏性变更报告（0.2.2-deltas.md）
├── src/extension.js   # 扩展入口：宿主 fork、插件移植、配置同步
└── .smoke/            # 打包脚本、平台补丁库与冒烟测试
```

### 打包

```bash
# 生成 dsh-vscode.vsix（标准 zip + vsix 清单，剔除 *.map）
python .smoke/pack.py
```

> 优先使用 `.smoke/pack.py` 而非 `npx @vscode/vsce package`：vsce 的依赖清单校验不兼容 pnpm 扁平布局，且文件遍历明显更慢。
>
> `pack.py` 打包前会做两件事：`platform-patches.py verify`（平台补丁缺失/漂移直接拒绝打包）与按 `PRUNE` 列表剔除**非 Windows 的 wasm 回退包**（`@deepseek-ai/libreoffice-kit-wasm`、`@img/sharp-wasm32`，共 ~154 MB 原始体积）。0.2.2 平台的 vendor 树约 1.03 GB，剔除后 vsix 约 **450 MB**（不剔除要多 ~75 MB）。打出来的包可用 `.smoke/installed-boot.mjs` 从包内直接起宿主验收。

### 升级平台（重建 `vendor/`）

```bash
# 1. 干净安装到 staging（不要在仓库根目录里装，根 node_modules 是开发用）
mkdir .tmp-vendor/stage-<ver> && cd .tmp-vendor/stage-<ver>
printf '{"name":"dsh-vscode-platform-stage","version":"0.0.0","private":true,"dependencies":{
  "@deepseek-ai/dsh":"<ver>","@vscode/ripgrep":"1.18.0","@vscode/ripgrep-win32-x64":"1.18.0"}}' > package.json
npm install --no-audit --no-fund
# 2. 整体替换 vendor/node_modules（旧树先挪走，便于对比差异）
#    robocopy .tmp-vendor/stage-<ver>/node_modules vendor/node_modules /E /XF .package-lock.json
# 3. 重导平台补丁：python .smoke/platform-patches.py verify → apply / 按 NOTES 重新移植
# 4. 冒烟：plugin-compat → platform-api-scan → boot-test → extension-proxy-test
# 5. 2.2 起平台的破坏性变更在 vendor/.../@deepseek-ai/dsh/docs/upgrade-guide/，先读它再动手
```

> `.smoke/gen-presets.py` 在改 `plugins/presets/` 之后必须重跑（生成 `@dsh-vscode/presets` 与 `dsh-preset-*` 包）；它会在发现相对模块名时直接报错退出，因为 0.2.2 的预设子行名只从 profile 解析。

### 冒烟测试

| 脚本 | 作用 |
| --- | --- |
| `.smoke/platform-api-scan.mjs` | 扫描内置插件对平台（`@deepseek-ai/*`）的每一个具名 import，核对当前 vendor 树是否仍导出它。**升级平台后应先跑这个**——插件是外部预构建产物，平台删掉一个导出会让宿主启动时直接崩，而报错只提插件不提根因 |
| `.smoke/plugin-compat.mjs` | **0.2.2 新增**：在本地复刻宿主的插件兼容性闸门（`engines.dsh` 优先、否则 peer 范围，`includePrerelease` 语义），逐个断言 `BUNDLED_PLUGINS` 能挂载；同时检查每个平台 peer 在 vendor 树里确实存在（`dsh-better-sidebar` 曾 peer 一个已被删除的 `dsh-invariants`）。门禁不通过 = 插件会被宿主静默跳过 |
| `.smoke/session-history-check.mjs` | 用平台自己的 v0 会话校验器扫某个 `DSH_HOME` 下的 **v0** 历史会话，报告哪些会被**拒绝加载**及原因。0.2.2 起日志名是 `session.v<N>.jsonl.zstd`（N 为已存格式版本），脚本只校验尚未迁移的 v0 文件，并会明确报告「本地没有 v0 语料可验」——拿 0.1.x 写的旧 `DSH_HOME` 备份来测才有意义 |
| `.smoke/platform-patches.py` | `verify` / `apply` 保存在 `.smoke/platform-patches/` 的 vendor 平台补丁（0.2.2 起 7 条 / 8 个文件）。**`vendor/` 整体重建后必须跑 `apply`**；`pack.py` 会在打包前自动 verify，补丁缺失直接拒绝打包。逐条裁决（保留/上游已修复/退役）见 `.smoke/platform-patches/NOTES-0.2.2.md` |
| `.smoke/boot-test.mjs` | 起真实宿主 + 临时 `DSH_HOME`，移植 `plugins/bundled` 并写入兼容性豁免，断言首页与每个 **web 客户端**条目的带 revision 插件 URL 都返回 200、且在前端模块图里有对应行；**0.2.2 起还通过 Typert Remote `agentPresets/list` 断言每个预设都能组装（`broken` 为空）**——失败的预设会留在名单里而不是启动失败。`--only=a,b` 可只跑指定条目，`--keep-home` 保留临时 home，完整宿主日志落在 `.smoke/.last-boot.log` |
| `.smoke/extension-proxy-test.cjs` | 用 stub 的 `vscode` 模块加载真实 `src/extension.js`，跑 `activate()` 起宿主与鉴权中转代理，然后**不带 Cookie** 去探测代理端口：首页须 200、未知 `/api` 通道不得是 401/403、`ws://…/api/remote.mux` 须返回 101 |
| `.smoke/annotations-clear-test.mjs` | 驱动真实宿主（经扩展代理，即 webview 实际路径）验证：无 live agent 时 `comments: []` 返回 `200 {kind:"empty"}`，非空草稿返回 `200 {kind:"ready", snapshotId}`（按 sessionId 暂存），清空后再写再清均成功，并证明直连与经代理结果一致 |
| `.smoke/profile-overlay-test.mjs` | 验证 `dsh.modlensFamilies` → `--patch` 覆盖层这条链路：驱动真实 `activate()` 断言覆盖层已生成且 YAML 转义正确（含 `:` 和引号这类值）、**你自己的 `cordis.patch.yml` 未被改写**、诊断日志已带启动头落盘，并用 `dsh --dump-config` 证明 DSH 真的把它合成到了 modlens 行上——而且**一个不少地保留其余行**（对比开关覆盖层前后的行集合；若某个 `id` 行被当成顶层条目重新组装整棵树，其它插件会全部掉线而旧断言仍然通过） |
| `.smoke/bundled-patches.mjs` | 断言我们对**内置第三方代码**的每个本地补丁都还在：web-review 的 `description` thunk / `ctx.layout.closeDetails?.()` / 批注 source `plugin:dsh-web-review`、zh-kit 的 `plugin:${name}`、rewind 的压缩后撤回、auto-continue 的 `settingsScope` 死注入移除、ppt-master 的 bundle-only shell。内置插件每次启动会从 `plugins/bundled` 重新移植，补丁能扛过重启，但**扛不过上游刷新**——那会静默还原，于是现在会在这里失败 |
| `.smoke/client-command-shape.mjs` | 扫描 `plugins/bundled` 里所有**客户端包**（以 `__ModuleLoader__` 识别），断言每处 `command.register({...})` 的 `description` 都是**函数**——0.1.5 客户端会调用它，传字符串会让**整个 `/` 指令源**报错消失（只剩技能）；保留 thunk 形式对 0.2.2 同样安全 |
| `.smoke/windows-hide-test.mjs` | **0.2.2 起改为「上游不许回退」的守护**（本仓库的两条相关补丁已删除，平台已自带修复）：断言 `launchWindowsJob` 的 spawn 参数带**无条件** `windowsHide: true`、fallback 路径（`runner-launch-*.js`，按内容定位而非硬编码 chunk 名）仍保留自己的设置、**两个 `STARTUPINFOW` 站点都置了 `STARTF_USESHOWWINDOW`（`dwFlags: 257`）+ `wShowWindow: 0`**、受限调用点**不得**使用 `CREATE_NO_WINDOW`（`0xC0000142` 风险）；再**真跑一条受限命令**端到端，并让子进程报告 Windows 是否给它分配了控制台（`windowsHide` 走 `CREATE_NO_WINDOW`，返回 `NO_CONSOLE`） |
| `.smoke/embedded-open-settings-test.mjs` | 用桩驱动真实的 `SettingsController`，验证「打开配置文件」在 `DSH_EMBEDDED=1` 时输出扩展哨兵且**不**调用原生打开器，未设置时走原生路径 |
| `.smoke/legacy-cleanup-test.cjs` | 用合成 `DSH_HOME` 复现每一类升级残留（悬空/跨版本/全局 npm 链接、失效 profile 依赖、空 scope 目录、`*.pnpm-old`、`.ignored_*`、`.bak-*`、退役插件状态、旧的 `.agent-presets/<内置 id>`），跑真实 `activate()` 后断言残留已清、**且会话/记忆/配置/在用插件与用户自己预设的状态逐字节未变**、退役状态可在隔离目录找回 |
| `.smoke/selfcontained-plugins.mjs` | 校验 `plugins/bundled` 与 `BUNDLED_PLUGINS` 一致：每个条目要么被声明、要么被某个条目的 cordis patch 认领（mnemon 的 sibling 包、预设挂载的 `dsh-preset-*` 走这条路）；`_hostdeps` 每项必须是真包（scoped 目录按 scope 展开）；仍注入已删除 `dsh-client-runtime` 的只告警不判失败（非行 inject 在 0.2.2 被安全跳过） |
| `.smoke/gen-presets.py` | **0.2.2 新增（生成器）**：把 `plugins/presets/` 的旧式预设目录转成 `@dsh-vscode/presets` bundle（`@deepseek-ai/dsh-agent-preset` 声明行）并为本地 `.mjs` 入口生成 `dsh-preset-*` 真实包；发现相对模块名会报错退出。改预设源后必须重跑 |
| `.smoke/installed-boot.mjs` | **打包后验收**：解包真实 `.vsix`，从**包内**的 `vendor/` + `plugins/bundled/` 起宿主，断言 `HOST READY`、首页 200、每个内置 web 客户端条目都在模块图里、预设名单全部可组装，并断言被 `PRUNE` 的 wasm 包确实不在包里。仓库里的 `boot-test` 证明源码树能跑，这个证明**打出来的包**能跑（打包会剔 map 与非 Windows wasm 回退包） |
| `.smoke/ui-boot-test.mjs` | **真实浏览器验收（部署运行时）**：解包 `.vsix`（或 `--from-repo` 用仓库树），用 VS Code 自带的 `Code.exe`（`ELECTRON_RUN_AS_NODE=1`）起宿主，再开 headless Edge/Chrome 经 CDP 打开页面，断言引导卡片消失、页面渲染出应用内容、**0 条 error 级控制台输出**、客户端插件 bundle 有被广告、宿主没有跳过/崩溃条目。存在的理由：有两类缺陷宿主侧完全看不见——dsh-mcp 客户端挂载死锁（页面卡「Loading plugins…」，宿主全绿）与 Electron 指纹拒绝（node.exe 起得来、VS Code 里起不来），都只有这条能抓到 |

## 🧱 工作原理

1. 扩展在扩展宿主内以 `ELECTRON_RUN_AS_NODE=1` 方式 fork 内置 DSH 宿主：`dsh --profile web --port 0 --no-open`（宿主用 OS 分配的临时端口），用 VS Code 二进制充当 Node 运行时。
2. 宿主监听 `127.0.0.1` 的临时端口，提供预构建网页前端（`@deepseek-ai/dsh-web-frontend/dist`）。扩展在**固定端口**（`dsh.port`，默认 `37750`）上另起一个中转代理供 webview 使用，见第 4 条。
3. Webview 面板通过声明稳定的 `WebviewPortMapping`（`{ webviewPort: port, extensionHostPort: port }`，两者都是上面的固定端口），让 iframe 及全部 `/api` 请求落到该端口——也就是落在这个中转代理上。
4. **启动令牌 → Cookie → 本地中转代理（0.1.5 起新增）**：宿主启动时打印 `dsh web: http://127.0.0.1:<port>/?token=<launchToken>`，对根路径的裸 `GET /` 一律返回 `401`。0.1.5 的鉴权模型是：**只有** `GET /?token=<t>` 这一次请求会签发 `HttpOnly` 会话 Cookie 并 `303` 重定向到 `/`，此后首页与**每一个** `/api` 请求都**只认这个 Cookie**（`BrowserAuth.isAuthenticated`），且没有任何配置可以关闭。

   在 VS Code 里 webview iframe 属于**第三方上下文**（`vscode-webview://` 内嵌 `127.0.0.1`），其请求由 VS Code 的端口映射层中继而非渲染进程直发，因此中继响应上的 `Set-Cookie` 永远不会进入浏览器 Cookie 罐——重定向后的 `GET /` 不带 Cookie，面板就会显示 DSH 的 `dsh web authentication required` 页面。

   所以**不由浏览器承担认证**：扩展宿主自己完成 token 交换（普通 Node 请求，能拿到 `Set-Cookie`），并在端口映射指向的稳定端口上运行一个**本地回环反向代理**。代理负责注入 Cookie，并剥掉 DSH 的 Host/Origin 围栏会拒绝的浏览器标记（`Sec-Fetch-Site: cross-site` 是硬 403，跨源 `Origin`/`Referer` 也过不了同源检查）。**启动令牌完全不会进入 webview**。宿主本身改用 OS 分配的临时端口，`dsh.port`（默认 `37750`）现在描述的是代理端口。`DSH: Open in External Browser` 仍直接打开带 token 的宿主地址，由真实浏览器自行完成交换。
5. Web 客户端以 fetch（SSE 流式响应）承载对话，但 **RPC mux 是 WebSocket**：客户端会打开 `ws://<origin>/api/remote.mux`，中转代理必须转发 upgrade（`.smoke/extension-proxy-test.cjs` 断言返回 101），否则面板能渲染但一直「自动重连中…」。0.2.2 的 Typert Remote（如预设名单 `agentPresets/list`）也走这条 mux。
6. 插件前端资源不走裸 `/plugins/<id>/client.js`：模块注册表只服务它自己广告的**带 revision 的合并 URL**。**0.2.2 起该 URL 是相对文档的 `plugins/??<id>/client.js,…&rev=<hash>`**（0.1.5 是根相对的 `/plugins/??…`），裸路径仍返回 404；扩展的「客户端表面」日志因此同时接受两种形式。
7. **插件兼容性与预设（0.2.2 起）**：宿主启动时按 `engines.dsh` / peer 范围做兼容性闸门，不匹配就静默跳过（日志只有一行），扩展为此在 `<profile>/compatibility.json` 写入「经过验证的豁免白名单」（默认为空，见 `PLUGIN_VERSION_EXEMPTIONS`）。预设不再从 `<DSH_HOME>/.agent-presets/` 目录读取，而是作为 bundle patch 里的 `@deepseek-ai/dsh-agent-preset` 声明行由 `@dsh-vscode/presets` 提供；旧目录里本扩展写过的三个 id 会在启动时清掉。

## ❓ 常见问题

**问：安装后宿主启动失败？**
答：确认 VS Code ≥ 1.133；查看 `DSH: Show Host Logs` 输出；若曾升级旧版本，可尝试 `DSH: Restart Host`。

**问：面板空白/页面加载不出来？**
答：执行 `DSH: Open in External Browser` 确认宿主是否正常服务；仍异常时通过日志定位或重置 `dsh.dshHome` 指定的配置文件目录。

**问：升级扩展后会话/配置会丢吗？**
答：不会。会话、设置等数据存放在 `dsh.dshHome`（默认 `DSH_HOME`）目录，与扩展安装目录相互隔离。

**问：日志怎么给你？（`DSH: Show Host Logs` 关掉窗口就没了）**
答：同一份日志现在**同时落盘**在 `<globalStorage>/li554.dsh-vscode/dsh-vscode.log`（超过 4 MB 自动轮转为 `.log.1`）。每次启动会先写一段头信息——扩展版本、`DSH_HOME`、工作目录、`dsh.port`、是否启用内置插件——因为排障真正需要的上下文正是这些，而不是随后的散行。宿主 stdout/stderr、token 交换、代理的 401 与上游错误、以及**经代理返回的非 2xx 响应（含路径）**都会记进去；`/plugins/` 的包请求除外（页面陈旧时会合法 404），且每次会话最多记 200 行以免刷爆。

宿主起来后还会写一行**客户端表面**：
```
client surface: 91 mounted of 16 shipped (every shipped client plugin mounted)
```

「shipped」是移植进 `<profile>/node_modules` 的插件里声明了 `dsh.client` 的那些，「mounted」是宿主在 shell 里**真正公布**的客户端插件。**插件没挂载是无声的**——`inject` 得不到满足时宿主会直接跳过它，日志里一个字都不留（「撤回插件完全没输出」就是这么来的）。所以这一行专门把沉默变成名单：如果某个插件的 UI 什么都不做，看这里有没有 `shipped but NOT mounted: …`。**回退功能**尤其适合用这行判断：`dsh-rewind-plugin` 依赖平台的会话/存档链路，只要链条上任一环没挂上，它的回退按钮就不会被挂载——于是图标不出现、归档读不出来，同时日志一片安静。

**问：记忆标签页 / `Failed to fetch`？**
答：explore.17 起已**移除** `dsh-memory-evolve`。升级后重启宿主，旧 profile 里的该插件会被自动 prune；若仍看到记忆 Tab，执行 `DSH: Restart Host` 或重载窗口。`Failed to fetch` 通常是宿主进程已退出（见 Host Logs 的 `host exited` / `deactivate`），面板会自动尝试拉起；拉不起来再点 Restart Host。

**问：会话头部没有「回滚」按钮，`/undo` 也说没有可回滚的消息？**
答：回滚点是**在你自己发消息的那一刻**抓的。`rollback-undo` 挂在 `agent/pre-step` 上，为每个合格回合抓一个 before-tree（用 **git** 抓），据此决定按钮是否渲染（`if (view.value?.messageId === void 0) return null`）。所以它要求**四件事同时成立**：

1. 你发的是一条**纯文本**消息——`topLevelText()` 要求 source 是 `user`、不是 `steer` 投递、且**所有内容块都是 text**；**带附件的消息直接不合格**；
2. 该会话**有工作区**（`session.header.cwd`）；
3. 该工作区**是 git 工作树**；
4. 宿主进程**能跑到 `git`**——它继承 VS Code 的环境，所以「机器上装了 git」不等于「宿主能用 git」。

前三条里任何一条不成立，以前都**不留痕迹**；现在宿主日志会明确写出原因：

```
rollback undo: no undo coverage for this turn — the session has no workspace (cwd), …
rollback undo: no undo coverage for this turn — the prompt is not a single plain-text user message, …
rollback undo: before-tree snapshot unavailable, admitting prompt without undo: <error>   （抓快照失败时）
git probe: git version 2.50.0.windows.1        （能跑到 git）
git probe: cannot run git (ENOENT: …)          （宿主环境里没有 git）
```

抓不了快照时插件**故意不阻塞对话**（注释写着 "Snapshot must never block the conversation"），所以「没有回滚按钮」本身不是故障，但要能从日志里看出**为什么**。

**问：装进 VS Code 后打开报错 / 面板显示 `host preparation failed`？**
答：0.4.0 装进 VS Code 会起不来，日志里是 `node-addon-require-builtin unsupported: Unsupported/no-context (unsupported Electron runtime fingerprint: Node 24.22.1, V8 15.0.245.31-electron.0)`。原因：DSH 0.2.2 用这个原生 addon 取 Node 内部模块，而它按**精确 Electron 版本白名单**校验；扩展把宿主跑在 VS Code 自带的二进制上（`ELECTRON_RUN_AS_NODE=1`，VS Code 1.144.1 = Electron 43.8.3），不在白名单里，宿主在准备阶段就 exit 1，面板停在错误页。用 `node.exe` 跑宿主永远触发不到，所以开发期测试全绿。**0.4.1 已修复**：改为优先走 `--expose-internals` 原生路径、addon 仅作兜底（与平台自己的 `cordis-plugin-loader`/`dsh-hmr` 同一写法），补丁在 `.smoke/platform-patches/dsh-app-boot/`，由 `pack.py` 打包前字节校验。升级到 0.4.1 后若仍看到旧错误页，执行一次 `DSH: Restart Host` 或重载窗口；诊断看 `DSH: Show Host Logs` 或 `<globalStorage>/li554.dsh-vscode/dsh-vscode.log`（每次启动先写版本、`DSH_HOME`、工作目录等头信息）。

**问：为什么 .vsix 变到 ~450 MB 了？**
答：0.2.2 的平台闭包比 0.1.5 大得多（1.03 GB vs 224 MB）：新增了 Office 套件（`libreoffice-kit-*` 占 335 MB）、语音、computer-use、插件市场等 bundle。为了不白涨约 75 MB，`pack.py` 在打包时剔除非 Windows 的 wasm 回退包（`libreoffice-kit-wasm`、`sharp-wasm32`）；其余仍完整内置，换取"零依赖、开箱即用"（宿主运行时、网页前端、生态插件全在包里，用户机器不需要 Node/npm/pnpm/Python）。若还要更小，可再权衡是否砍掉 Office 套件（`office-kit`/`skill-office` 两行 + `libreoffice-kit-*`，约再省 200 MB）——那是功能取舍，不是打包细节。

**问：MCP 页面去哪了？（0.2.2 起）**
答：旧的内置 `dsh-mcp` 已**退役**。它的宿主半仍可用，但 client 半会自行挂载与官方管理器**同命名空间**（`mcpManager`）的 Remote contribution，两个客户端挂载把 0.2.2 的 client gateway 串行挂载队列卡死，面板会永远停在「Loading plugins…」。0.2.2 自带官方 MCP 管理器（`@deepseek-ai/dsh-mcp-manager` + `dsh-mcp-client`），MCP 服务器改由它（以及设置页里自动生成的表单）管理；代价是失去旧插件的「MCP 管理页面 / OAuth / `mcp_tool_search` 热注入」。

**问：某个内置插件的界面没了，日志里只有一行 `skipping profile bundle`？**
答：0.2.2 的**插件兼容性闸门**在启动时按 `engines.dsh`/peer 范围判断插件能否在本运行时上跑，不匹配就跳过。看 Host Logs 里 `skipping profile bundle "<名字>"` 的 requirements；正确做法是把插件升到声明 0.2.x 兼容的版本（本版本所有内置插件都已升级并全部通过，`.smoke/plugin-compat.mjs` 可复检）。扩展仍保留向 `<profile>/compatibility.json` 写「已验证豁免」的机制，但默认白名单为空——不要为了消掉警告而给未验证的插件开豁免。

**问：内置的 Router / PPT 预设去哪了？**
答：0.2.2 的预设 registry 不再扫描 `<DSH_HOME>/.agent-presets/`，预设改由 bundle 声明。本版本用 `@dsh-vscode/presets` 提供 `router-standard` / `router-spec` / `ppt-master` 三个预设（在会话的预设选择器里可见，`.smoke/boot-test.mjs` 会断言它们都能组装）；旧目录里本扩展写过的三个 id 会在启动时被清掉，**你自己放进 `.agent-presets/` 的其他预设目录不会被删**，但它们也不再被平台读取——要保留请迁移成 bundle 声明（见 `vendor/.../@deepseek-ai/dsh-agent-preset/skills/dsh-doc/references/compositions.md` 的「Migrate a legacy preset」）。

**问：升级后旧会话还打得开吗？会不会被改写？**
答：会照常打开，且**升级是单向的**：0.2.2 在读取时把旧格式会话迁移到 v4（`session.v<N>.jsonl.zstd`），原始 v0 文件不会被原地修改；但回退到 0.1.5 后，0.1.5 不认 v4 文件。第三方插件当年写进 v0 的规格外字段由 `.smoke/platform-patches/` 的 v0 容错补丁容忍（只丢弃、只记一次日志），升级前可用 `.smoke/session-history-check.mjs <DSH_HOME>` 预检。另外 0.2.2 要求 Node.js ≥ 24.9——运行时用的是 VS Code 自带 Electron 的 Node，这条 `engines` 不会在进程内强制校验，属于「能跑但非官方支持」的边界。

## 👥 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——上游网页宿主
- [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)——@linxin666 插件生态
- [23swccp/dsh-undo](https://github.com/23swccp/dsh-undo) 等其他内置插件作者

## 📄 许可证

[MIT](LICENSE)