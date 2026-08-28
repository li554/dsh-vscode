# @dsh-external/dsh-diff-review

Codex 风格的文件改动审阅插件（turn debug check）。

## 功能

### 1. 对话内：每轮文件改动摘要

每一轮对话结束后，在消息下方自动渲染「文件改动」卡片：

- 本轮修改的文件明细
- 每文件 `+N −M` 行数增减
- 点击文件在侧边栏打开完整 diff（复用 `dsh-better-sidebar` 内置 diff 视图）

### 2. 侧边栏：「审阅」tab

通过 `dsh-better-sidebar` 的公开 service（`ctx.betterSidebar.registerTab`）在现有侧边栏注册一个 **审阅** tab：

- 列出当前会话所有轮次的文件改动
- 点击文件打开内置 diff tab（`openTab({ type: 'diff', diff: { kind: 'worktree', path } })`）

### 数据来源

Host 侧监听 `session/event` 追加流，跟踪 `edit` / `write` / `str_replace_editor` 工具调用：

- 在工具执行前读取文件旧内容
- 根据工具参数计算新内容
- 使用 `diff` 生成 unified diff 与 +/− 行数
- 按 session + turn 聚合并通过 `/api/dsh-diff-review/*` 提供给浏览器半区

不依赖 git：无 git 仓库的工作区也能看到 agent 的文件改动轨迹。

## 安装（npm 形式）

本仓库支持直接作为 npm git 依赖安装——`prepare` 脚本会在安装时自动构建 `lib/`（无需 DSH 源码 checkout，需要 Node.js 与 npm）：

```json
{
  "dependencies": {
    "@dsh-external/dsh-diff-review": "git+https://github.com/Nomit8088/dsh-diff-review.git"
  },
  "dsh": {
    "profile": {
      "bundles": ["@dsh-external/dsh-diff-review"]
    }
  }
}
```

> 国内网络可加前缀：`git+https://gh-proxy.com/https://github.com/Nomit8088/dsh-diff-review.git`

也可以发布到 npm registry 后直接装：

```sh
npm install @dsh-external/dsh-diff-review
```

## 结构

```
src/index.ts                    host half：事件跟踪 + diff 计算 + HTTP API
src/client/index.ts             browser half：turnTail 槽位 + 侧边栏 tab 注册
src/client/TurnDiffCard.tsx     对话内每轮改动卡片
src/client/ReviewSidebarTab.tsx 侧边栏审阅 tab
src/client/types.ts             wire 类型与 API 访问
scripts/build.mjs               自包含构建（npm install / prepare 触发）
scripts/build.sh                bash 包装（兼容 dev_build_plugin 工具链）
cordis.patch.yml                bundle 层插入插件行
```

## 开发

```bash
npm run build          # tsc host + tsdown client → lib/
npm run typecheck      # host 类型检查
```

## 注入本地 DSH

```bash
dev_install_package /path/to/dsh_diff_review
```

## License

BSD-3-Clause
