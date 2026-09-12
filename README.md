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

## 🔌 内置插件

> **探索分支说明**：本分支（`explore/dsh-0.1.5-rc2`）把内置平台升级到 `@deepseek-ai/dsh@0.1.5-rc.2`，并把内置插件从原先的整套生态**裁剪为下面 5 个**，其余全部移除（见 `src/extension.js` 的 `RETIRED_PLUGINS`，旧 `DSH_HOME` 里的残留插件会在下次启动时被清理）。

扩展在 `plugins/bundled` 下随附以下插件（各自保留原 LICENSE）：

| 插件 | 来源 | 说明 / 本地改动 |
| --- | --- | --- |
| `dsh-memory-evolve` | [csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) | 分层记忆（全局/用户/项目/GIT 分支/每日）+ 自我进化 + 技能/待办管理，带 WebUI。精简打包为 `lib` + `vendor`；`dsh.client.inject` 已由已消失的 `dsh-client-runtime` 改为 `dsh-client-ui-slots` + `dsh-client-ui-primitives` |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 请求被网络错误等非人为原因中断时自动续写（升到 0.11.5） |
| `@canglongcl/dsh-web-review` | canglongcl | 页面预览 + 元素框选批注 + 视觉调整（升到 0.6.0；0.6.0 起它自己也已改用官方 slot，不再依赖 better-sidebar） |
| `dsh-undo-plugin` + `@dsh-undo/*`（7 个成员包） | [23swccp/dsh-undo](https://github.com/23swccp/dsh-undo) | 对话回退/撤销：`/undo` 命令、消息行与头部回退按钮、回退时 fork 到新会话（模型不会看到被撤销的提示）、设置页「归档任务」管理器、影子 Git 文件恢复（绝不碰项目自身的 `.git`）。`rollback-fork` 有一处针对 0.1.5 的本地修补，见下 |
| `@dsh-vscode/p2h-bridge` | 本仓库自研 | PPT↔HTML 桥：`slides_import`/`slides_export` 宿主工具、`/html-slides` 静态预览路由、以及对话区的「PPT」标签页（导入 / 内联预览 / 导出 / 上传管理）。设计文档见 `docs/superpowers/specs/2026-08-29-dsh-ppt-html-review-workflow-design.md` |
| `_hostdeps/`（docgen-utils、fontkit、jszip、linkedom 及其闭包） | npm 包 | p2h-bridge 宿主侧所需的非平台依赖，内置以便离线解析 |

> `dsh-undo-plugin` 只是 bundle 层，真正的插件是它 cordis patch 挂载的 7 个 `@dsh-undo/*` 成员包——所以它们不在 `BUNDLED_PLUGINS` 里，由 `.smoke/selfcontained-plugins.mjs` 按「被 patch 认领」校验。

**本分支的本地改造（相对上游）**

- `@dsh-vscode/p2h-bridge` 0.2.1 → 0.3.0：原本是挂在 `dsh-better-sidebar` 标签栏里的侧边栏标签页，现改为注册平台官方 slot `conversation.view`（`order: 15`），**紧邻「轨迹」标签页右侧**；同时移除对 `betterSidebar` 服务的全部探测与 web-review 预览标签页的外部驱动（web-review 0.6.0 已不再提供该公开 API），预览改为面板内联 iframe + 「新窗口」兜底。调研与 0.1.1→0.1.5 API 差异见 `docs/superpowers/specs/2026-09-01-p2h-bridge-conversation-view-tab-research.md`。
- `@dsh-undo/rollback-fork`：上游 `@deepseek-ai/dsh-agent-presets` 在 0.1.1-rc.2 之后删掉了 `resolveSessionPreset` 导出，而 dsh-undo rc.8 正是 `import` 它——**这会让整个宿主启动失败**（cordis 报的是「加载插件失败」，看不出根因在平台）。已把 0.1.1 那个 8 行实现内联回来（0.1.5 仍在产生它依赖的 `agent-preset/selected` 事件与 `header.agentPreset` 字段）。用 `.smoke/platform-api-scan.mjs` 可一次性扫出这类断裂。
- `dsh-memory-evolve` 的 `dsh.client.inject` 修正（见上表）。
- **「打开配置文件」内嵌桥接恢复**（`@deepseek-ai/dsh-api-settings-controller`，见 `.smoke/platform-patches/`）：0.1.1 时这个职责在 `dsh-host-apiproxy` 里——`DSH_EMBEDDED=1` 时把设置文档路径打到 stdout（`[dsh-vscode:open-settings] <path>`），由扩展在 VS Code 编辑器里打开，因为**内嵌部署下原生打开器用户根本看不见**。0.1.5 删掉了 `dsh-host-apiproxy`，设置职责搬到 `dsh-api-settings-controller`，而那里的 `openSettingsDocument` **无条件**调用 `openTextFile`：环境变量判断和哨兵都没了，也没有 `openAgentPresetDirectory` 那样的「返回路径」分支。0.1.5 全平台**不再读取 `DSH_EMBEDDED`**（仅剩 `DSH_AGENTS_HOME`、`DSH_BUNDLED_SKILL_DIR`、`DSH_TELEMETRY_DISABLED`、`DSH_WEB_FETCH_PROVIDER`、`DSH_WEB_SEARCH_PROVIDER`），没有官方接缝可用——于是面板里点「打开配置文件」**毫无反应**。已在接手同一职责的 handler 里恢复该分支，并保留 `internals.openTextFile` 接缝（`.smoke/embedded-open-settings-test.mjs` 用桩驱动真实 controller，验证开/不开 `DSH_EMBEDDED` 两种路径）。
- **会话格式迁移的插件兼容层**（`@deepseek-ai/dsh-session-format-v0-to-v1`，见 `.smoke/platform-patches/`）：0.1.5 引入了会话格式版本化，v0→v1 迁移对「已发布 v0 规格」之外的内容**一律拒绝**，且一个事件不合格就让整个会话无法读取。而**第三方插件当年往 v0 会话里写了不少规格外内容**，于是升级后旧历史打不开。已加入四类容错（各自只记录一次日志，原始 v0 文件永不修改）：丢掉内容块上的插件注解（`dsh-file-review` 的 `dshFileReview`）、丢掉插件 source 上的多余成员（`dsh-web-review` 的 `snapshotId`）、丢掉非 `notice` 形式下多余的 `summary`（`dsh-mnemon`）、把 `subagent/descriptor` 的 version 2 提升为 3（`sidechat` 插件）。实测某份 30 会话的真实历史：修复前 **21 个会话、1251 个事件被拒**，修复后 **0**。
- **升级残留自动清理**（`pruneRetiredArtifacts`，每次启动宿主前运行）：反复升级的 `DSH_HOME` 会积累三类没人清理的残留。
  1. **失效的模块回退链接**：`<home>/profiles/node_modules` 是大量指向「当前扩展 vendor 树」的 junction，而 DSH 自己的修复**只遍历当前版本依赖闭包里的包**——被新平台移出闭包的包会一直保留旧版本留下的链接，等那个旧扩展被卸载后就变成**悬空链接**。实测某台机器上有 **17 条**悬空链接（全部指向已卸载的 `0.2.53`），包括 `dsh-client-runtime`、`dsh-host-apiproxy` 这些 0.1.5 已删除的平台包，以及 `react`/`react-dom`/`zustand`/`immer`/`clsx` 一族。删除后 DSH 会用**正在运行的**那份安装重新建立它们。
     > 规则刻意收得很窄：**只删目标已不存在的链接**。仍能解析的链接即使指向另一个扩展版本或全局 npm 安装，也**保留**——因为这些包（`katex`、`shiki` 等）根本不在 0.1.5 的 vendor 闭包里，链接可能是唯一副本，删掉是倒退而不是清理。这类链接只在日志里提示一次。
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

**问：为什么 .vsix 有 100+ MB？**
答：完整运行时依赖树内置在扩展内以保证离线可用，体积换取了"零依赖、开箱即用"的体验。

## 👥 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——上游网页宿主
- [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)——@linxin666 插件生态
- [23swccp/dsh-undo](https://github.com/23swccp/dsh-undo)、[csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) 等其他内置插件作者

## 📄 许可证

[MIT](LICENSE)