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

> **探索分支说明**：本分支（`explore/dsh-0.1.5-rc2`）把内置平台升级到 `@deepseek-ai/dsh@0.1.5-rc.2`，并把内置插件从原先的整套生态**裁剪为下面 4 个**，其余全部移除（见 `src/extension.js` 的 `RETIRED_PLUGINS`，旧 `DSH_HOME` 里的残留插件会在下次启动时被清理）。

扩展在 `plugins/bundled` 下随附以下插件（各自保留原 LICENSE）：

| 插件 | 来源 | 说明 / 本地改动 |
| --- | --- | --- |
| `dsh-memory-evolve` | [csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) | 分层记忆（全局/用户/项目/GIT 分支/每日）+ 自我进化 + 技能/待办管理，带 WebUI。精简打包为 `lib` + `vendor`；`dsh.client.inject` 已由已消失的 `dsh-client-runtime` 改为 `dsh-client-ui-slots` + `dsh-client-ui-primitives` |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 请求被网络错误等非人为原因中断时自动续写（升到 0.11.5） |
| `@canglongcl/dsh-web-review` | canglongcl | 页面预览 + 元素框选批注 + 视觉调整（升到 0.6.0；0.6.0 起它自己也已改用官方 slot，不再依赖 better-sidebar） |
| `@dsh-vscode/p2h-bridge` | 本仓库自研 | PPT↔HTML 桥：`slides_import`/`slides_export` 宿主工具、`/html-slides` 静态预览路由、以及对话区的「PPT」标签页（导入 / 内联预览 / 导出 / 上传管理）。设计文档见 `docs/superpowers/specs/2026-08-29-dsh-ppt-html-review-workflow-design.md` |
| `_hostdeps/`（docgen-utils、fontkit、jszip、linkedom 及其闭包） | npm 包 | p2h-bridge 宿主侧所需的非平台依赖，内置以便离线解析 |

**本分支的本地改造（相对上游）**

- `@dsh-vscode/p2h-bridge` 0.2.1 → 0.3.0：原本是挂在 `dsh-better-sidebar` 标签栏里的侧边栏标签页，现改为注册平台官方 slot `conversation.view`（`order: 15`），**紧邻「轨迹」标签页右侧**；同时移除对 `betterSidebar` 服务的全部探测与 web-review 预览标签页的外部驱动（web-review 0.6.0 已不再提供该公开 API），预览改为面板内联 iframe + 「新窗口」兜底。调研与 0.1.1→0.1.5 API 差异见 `docs/superpowers/specs/2026-09-01-p2h-bridge-conversation-view-tab-research.md`。
- `dsh-memory-evolve` 的 `dsh.client.inject` 修正（见上表）。
- **宿主接入改动**：0.1.5 给整个 Web 界面加了「每进程启动令牌」，裸 `GET /` 返回 401，扩展现在从启动行解析令牌并把 iframe 导航到 `/?token=<token>` 换取会话 Cookie（详见下方「工作原理」第 4 条）。

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

## 🧱 工作原理

1. 扩展在扩展宿主内以 `ELECTRON_RUN_AS_NODE=1` 方式 fork 内置 DSH 宿主：`dsh --profile web --port <固定端口> --no-open`，用 VS Code 二进制充当 Node 运行时。
2. 宿主监听 `127.0.0.1` 的固定端口（默认 `37750`），提供预构建网页前端（`@deepseek-ai/dsh-web-frontend/dist`）。
3. Webview 面板通过声明稳定的 `WebviewPortMapping`（`{ webviewPort: port, extensionHostPort: port }`），让 Service Worker 将 iframe 及全部 `/api` 请求代理到扩展宿主。
4. **启动令牌换 Cookie（0.1.5 起新增）**：宿主启动时打印 `dsh web: http://127.0.0.1:<port>/?token=<launchToken>`，对根路径的裸 `GET /` 一律返回 `401`。扩展从该行解析出端口与令牌，把 iframe 导航到 `/?token=<token>`；宿主校验令牌后签发 `HttpOnly` 会话 Cookie 并 `303` 重定向到干净的 `/`，此后所有请求凭 Cookie 通行。令牌是**每个宿主进程一份**的，所以扩展在宿主每次（重）启动时都重新解析并通过 `postMessage` 下发给 webview。除令牌/信任边界外**无需任何 DSH 源码改动**。
5. DSH Web 客户端仅使用 fetch + SSE（无 WebSocket），端口映射代理完全可以承载。
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