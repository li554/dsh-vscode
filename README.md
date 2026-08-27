# DeepSeek Harness for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

在 **VS Code** 内以 Webview 方式运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原生网页界面。扩展已内置全部宿主依赖与生态插件，用户机器 **无需安装 Node.js、npm、pnpm 或 Python** —— VS Code 自身即为运行时。

## ✨ 特性

- **零依赖开箱即用**：宿主运行时、网页前端、生态插件全部打进扩展，一条 `.vsix` 完成安装。
- **原生 DSH 体验**：完整渲染 Harness 网页界面（模型对话、工具调用、工作区、会话管理），无二次封装。
- **内置插件全家桶**：撤回/快照、分层记忆、任务看板、侧边栏增强、自动续写等生态插件随附启用。
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

扩展在 `plugins/bundled` 下随附以下第三方生态插件（各自保留原 LICENSE）：

| 插件 | 来源 | 本地改动 |
| --- | --- | --- |
| `dsh-recall-plugin` | [limbo947/dsh-recall-plugin](https://github.com/limbo947/dsh-recall-plugin) | 撤回确认框新增**回退范围选择**：整段回退（对话+文件）或仅回退对话 |
| `dsh-memory-evolve` | [csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) | 无（精简打包为 `lib` + `vendor` + `skills`） |
| `dsh-better-sidebar` | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 无 |
| `dsh-client-auto-continue` | [HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 无 |
| `@linxin666/dsh-*`（会话恢复、桌面启动器、医疗辅助、宠物、UI 面板等） | [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) / linxin666 生态 | 无。`dsh-ssh`、`dsh-client-ui-skin-center` 因原生 ABI 无法在 VS Code 内嵌 Node 中加载而被排除 |
| `dsh-miraculous-standard`、`@dsh-external/dsh-super-injector` | 社区包 | 无 |
| `_hostdeps/`（cosmokit、fflate、jpeg-js、schemastery） | npm 包 | 内置以便非平台依赖离线解析 |

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

1. 扩展在扩展宿主内以 `ELECTRON_RUN_AS_NODE=1` 方式 fork 内置 DSH 宿主：`dsh --profile web --port 0 --no-open`，用 VS Code 二进制充当 Node 运行时。
2. 宿主监听 `127.0.0.1` 的随机端口，提供预构建网页前端（`@deepseek-ai/dsh-web-frontend/dist`）。
3. Webview 面板通过声明稳定的 `WebviewPortMapping`（`{ webviewPort: port, extensionHostPort: port }`），让 Service Worker 将 iframe 及全部 `/api` 请求代理到扩展宿主。
4. DSH 的 `/api` 信任边界将代理请求识别为来自扩展宿主的干净回环请求（无浏览器 `Origin`/`Sec-Fetch-Site` 标记），**无需任何 DSH 源码改动**即可通过校验。
5. DSH Web 客户端仅使用 fetch + SSE（无 WebSocket），端口映射代理完全可以承载。

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
- [limbo947/dsh-recall-plugin](https://github.com/limbo947/dsh-recall-plugin)、[csyangwen/dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) 等其他内置插件作者

## 📄 许可证

[MIT](LICENSE)