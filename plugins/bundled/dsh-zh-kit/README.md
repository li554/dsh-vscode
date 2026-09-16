# dsh-zh-kit

[English](#english) | 中文

DeepSeek Harness（DSH）**中文工具包**，融合两个上游插件的功能：

| 能力 | 来源 | 形态 |
|---|---|---|
| 模型**中文优先**：推理（reasoning）与回答默认使用简体中文 | [deepseek-harness-zh-cn](https://github.com/imlishiyuan/deepseek-harness-zh-cn)（Apache-2.0） | 宿主侧 `agent/pre-step` |
| 轨迹视图（Trajectory）**中文化 + 「人话」解释** | [dsh-trajectory-zh](https://github.com/jun7799/dsh-trajectory-zh)（MIT） | 浏览器侧 DOM 投影 |

一个插件，同时解决「模型不说中文」和「轨迹页看不懂英文标签」两件事。

## 它做什么

### 1. 中文优先（宿主侧）

监听 `agent/pre-step` 瀑布事件，在每轮（turn）**第一步**把 `<system-reminder>` 用户消息追加进请求批次：

- 始终使用简体中文进行思考（reasoning）与所有最终回答
- 计划、工具调用、总结、代码注释同样使用简体中文
- 仅代码、命令、文件路径、变量名、API 名称等必须原样保留的内容使用英文
- 除非用户明确要求其他语言，否则本规则优先

> 说明：harness 与 DeepSeek API 均没有强制推理语言的开关；全中文提示词能把概率拉到最高，但不保证 100%。

### 2. 轨迹视图中文化（浏览器侧）

- **全量中文化**：轨迹页 55+ 个英文标签替换为中文（精确匹配，未收录的词自动保持原样）
- **人话解释层**：每个标签悬停即可看到「这到底是什么、什么时候出现、去哪里看更多信息」
- **一键开关**：页面右下角「轨迹中文化 · 开/关」悬浮按钮，状态存 localStorage，默认开启
- **零侵入**：纯浏览器侧 DOM 投影——不接触模型请求、不修改任何官方包文件

## 安装

前提：能启动 `dsh web`。

### 方式一：从 GitHub 克隆（推荐）

```sh
cd <你的DSH_HOME>/profiles/web

mkdir -p plugins
git clone https://github.com/CatmaoU/dsh-zh-kit.git plugins/dsh-zh-kit
pnpm add file:plugins/dsh-zh-kit
```

> v0.1.1 起插件**自带 `dsh.bundle.patch`（cordis.patch.yml）**——加载器装配 bundle 时会自动把 entry `dsh-zh-kit` 并入组合，无需再手动编辑 profile 的 `cordis.patch.yml`。
>
> 若仍想手动控制（例如用了 v0.1.0 或自定义 id），按老方式在 profile 的 `cordis.patch.yml` 加入：
>
> ```yaml
> - insert:
>     - id: dsh-zh-kit
>       name: 'dsh-zh-kit'
> ```
>
> ⚠️ 必须是 `insert` 列表写法。顶层直接写 `- id: ...` 是「按 id 修改已有条目」的语义，新增条目会被静默跳过。

### 方式二：手动放置

把本仓库的 `package.json`、`lib/`、`cordis.patch.yml` 复制到 `<DSH_HOME>/profiles/web/plugins/dsh-zh-kit/`，其余步骤同上。

### 生效

1. 重启 DSH（`dsh web`）
2. 浏览器**硬刷新**（Ctrl+F5）
3. 验证：右下角出现「轨迹中文化 · 开」胶囊按钮即成功

### 验证插件已伺服

直接访问 `http://127.0.0.1:<端口>/plugins/dsh-zh-kit/client.js`——应返回 JS 内容而非 404。

## 词典维护

所有词条集中在 `lib/client.js` 的 `DICT` 对象：

```js
"CONTEXT": {
  label: "上下文注入",                    // 替换后的中文
  tip: "不是你打的字：系统以「用户角色」…"  // 悬停解释（可选）
},
```

- 键 = 英文原文（trim 后**精确匹配**）
- 匹配不到的键不会被替换——上游升级后个别标签改名，只是那个词回落英文，不会报错
- 改完重跑 `pnpm add file:plugins/dsh-zh-kit` 同步到 node_modules，再重启刷新

## 工作原理

- **宿主半边**（`lib/index.js`）：`agent/pre-step` 瀑布监听（`prepend: true`），每轮第一步注入中文指令；v0.1.1+ 经 `dsh.bundle.patch` 注册为独立 loader 条目（host half 与 client half 同条目双注册），同一条目让 `dsh-client-modules` 发现包的 `dsh.client` 声明并把浏览器包伺服到 `/plugins/dsh-zh-kit/client.js`
- **浏览器半边**（`lib/client.js`）：以 `window.__ModuleLoader__.load({id, factory})` 注册（与官方 `dsh.client` bundle 同一契约），`immediately: true` 使其开机即物化；运行时用 MutationObserver 观察轨迹页 DOM，对文本节点做精确匹配替换并挂 `title` 提示
- 不依赖 React/cordis 等任何 peer——factory 内零 `require`；宿主仅依赖 `@deepseek-ai/dsh-llm` 的 `createUserMessage`（optional peer）

## 已知限制

- 中文替换基于英文原文精确匹配；DSH 升级若改了标签文案，对应词条失效（表现为该标签仍显示英文），更新词典即可
- 轨迹页 CSS 类名是构建哈希，本插件不依赖类名，只依赖可见文本与 `data-*` 属性
- 目前仅中文（zh-CN）；词典是单一对象结构，欢迎 PR 其他语言

## 协议

本项目为融合衍生作品：Apache-2.0（见 [LICENSE](LICENSE)），其中 MIT 部分额外以 [LICENSE-MIT](LICENSE-MIT) 提供；详见 [NOTICE](NOTICE)。

## English

A Chinese toolkit plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), fusing:

- **Chinese-first prompting** (host-side, from [deepseek-harness-zh-cn](https://github.com/imlishiyuan/deepseek-harness-zh-cn), Apache-2.0): appends a `<system-reminder>` user message on the first step of every turn asking the model to reason and answer in Simplified Chinese.
- **Trajectory-view localization** (browser-side, from [dsh-trajectory-zh](https://github.com/jun7799/dsh-trajectory-zh), MIT): replaces 55+ English labels (SYSTEM/CONTEXT/Payload/Schema/cacheRead…) with Chinese via exact-match DOM text projection, each with a hover tooltip; floating on/off toggle persisted in localStorage.

Install into your DSH web profile: clone into `plugins/`, `pnpm add file:plugins/dsh-zh-kit`, add an `insert` entry to `cordis.patch.yml`, restart DSH, hard-refresh the browser. See the 中文 section for details.

## License

Fused derivative work: Apache-2.0 (see [LICENSE](LICENSE)); the MIT-covered browser portion is additionally available under [LICENSE-MIT](LICENSE-MIT). See [NOTICE](NOTICE).