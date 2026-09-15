# dsh-rollback-withdraw

**面向 DeepSeek Harness Web 的 Trae 式会话撤回插件。** 在每条用户提问与助手回答旁提供一键撤回按钮：把**工作区代码**与**会话本身**（记忆、轨迹、目标）整体回滚到该消息之前的最后一个完整回合。

[简体中文](./README.zh-CN.md) · [English](./README.md)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)

---

## 它能做什么

DSH Web 会话中每个已完成的回合都会自动成为一个**回滚点**。点击任意消息旁的撤销图标，工作区文件即恢复到该消息之前最后一个完整回合的状态，同时会话在该处**分叉**并自动打开回滚后的对话——仿佛那段交流从未发生过。

- **工作区代码**：通过最佳可用后端恢复（见下）。
- **会话**：在边界处 fork 出子会话并打开；模型记忆、轨迹、目标与子代理血缘都与那一刻完全一致。
- **原生 git 集成**：工作区是 git 仓库时，回滚点就是真实提交，撤回 = `git reset --hard` + 安全的 `git clean`。

## 功能特性

- **每条消息都可撤回**——用户气泡下方、每个已完成回合的最后一条助手消息旁。
- **双恢复后端，自动选择：**
  - **git 模式**（默认开启，一键切换）：每回合结束提交 `rollback checkpoint <seq>`；撤回用 `git reset --hard` + 保留依赖/构建目录的 `git clean`。空间高效、与常规 git 工作流一致。
  - **文件快照模式**：否则在每回合结束生成硬链接快照——未变更文件跨快照共享同一副本，保留几百轮历史几乎零成本。
- **按工作区开关**——会话头部 git 分支图标一键切换 git 自动提交；选择持久化在 `.dsh-rollback/config.json`。
- **随客户端启动自动加载**——以 web profile bundle（`dsh.bundle` + `dsh.client`）形式打包，重启无需重新激活。
- **两步确认**——第一次点击进入"确认"状态（按钮变红），再次点击才执行，杜绝误撤回。

## 环境要求

| 项目 | 说明 |
| --- | --- |
| 操作系统 | Windows（依赖 `robocopy` 与 PowerShell 5.1+）；其他平台规划中 |
| Git | 可选——仅 git 模式需要 |
| DSH | web profile（`dsh web`） |

## 安装

```bash
# 从 npm 安装
dsh plugin --profile web add dsh-rollback-withdraw

# 或从本仓库安装
dsh plugin --profile web add github:dyhyfjn/dsh-rollback-withdraw

# 或本地构建
npm pack && dsh plugin --profile web add ./dsh-rollback-withdraw-0.1.0.tgz
```

安装后重启 Web 应用——插件集变更需重启生效。

## 使用方法

1. 照常与 agent 对话；每个回合完成后自动记录一个回滚点。
2. 悬停消息并点击**撤销图标**——第一次点击进入"确认"（变红），再次点击执行。
3. 工作区恢复，界面切换到分叉后的回滚会话，从这里继续。

会话头部的 **git 分支图标**表示 git 模式状态：

- 点亮（品牌色 + 右下角绿点）= git 自动提交**开启**；
- 灰暗 = **关闭**，或工作区不是 git 仓库（悬停有提示）；
- 工作区无 git 仓库时按钮禁用。

## 工作原理

- host 半部监听 `session/event`，在每个 `turn/end` 记录检查点——git 提交，或硬链接快照（存放在 `<工作区>/.dsh-rollback/snap/<会话>/<序号>/`）。
- 客户端按钮通过同源 HTTP 路由 `/rollback/rpc` 调用 host（静态插件通道，替代动态插件的 `harness.handle`）。
- 撤回流程：校验边界（该消息之前最近的 `turn/end`）→ 恢复文件 → 客户端在对应序号 fork 会话并打开子会话。
- 会话第一条消息无法撤回（没有更早的回合）；插件安装前的消息没有快照——按钮会说明原因。

## 配置

| 配置项 | 位置 | 默认 | 含义 |
| --- | --- | --- | --- |
| `gitAutoCommit` | `<工作区>/.dsh-rollback/config.json` | `true` | 工作区为 git 仓库时，用 git 提交作为回滚点 |

忽略路径（不纳入快照/提交/删除）：`node_modules`、`.git`、`dist`、`build`、`.next`、`.venv`、`__pycache__`、`.idea`、`.vscode`、`coverage`、`*.pyc`、`*.log` 等（详见 `lib/index.js` 中 `IGNORE_DIRS` / `IGNORE_FILES`）。

## 安全说明

`/rollback/rpc` 是本机 web 服务器上的同源、无鉴权路由——本插件假定仅个人、仅本机使用。请勿将 harness 端口暴露到不可信网络。

## 已知限制

- 优先支持 Windows（robocopy + PowerShell）；macOS/Linux 回退方案规划中。
- git 模式执行整仓库 `git reset --hard` + `git clean`（保留忽略目录）——回滚会删除未跟踪且未被忽略的文件。
- 撤回助手回答时也会一并回滚其前置提问（回到上一个完整回合结束点）；平台分叉原语只能在回合边界切割。
- 源会话保留在侧栏作为分支；不做自动归档。

## 开发

```bash
npm pack                 # 生成可发布的 tarball
node --check lib/index.js lib/client.js   # 语法检查
```

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
