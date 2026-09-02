# dsh-vscode PPT↔HTML 可视化批注工作流 设计文档

日期: 2026-08-29
状态: 待评审
范围: dsh-vscode 扩展内 "导入 PPTX → HTML 预览 → 元素级批注 → agent 改 HTML → 导出 PPTX" 闭环

***

## 1. 背景与目标

### 1.1 目标

在 dsh-vscode（DSH web profile 的 VS Code 扩展发行形态）内，为用户提供一条闭环：

1. 用户装入现有 `.pptx`；
2. 系统将其转换为可编辑的一页一文件的 HTML（16:9 舞台）；
3. 用户通过已内置的 `@canglongcl/dsh-web-review`（v0.5.0）在网页预览中**选中元素 → 写批注 → 注入对话**；
4. Agent 依据批注修改 HTML 源码（工作区内）；
5. 用户一键导出修改后的 HTML 为 `.pptx`。

### 1.2 非目标（明确放弃）

* **逐像素无损往返**：PPTX 与 HTML 是异构文档模型，docgen 转换是有损的（动画、复杂渐变、特殊字体被简化）。验收以 docgen 量化质量分为准，不追求逐像素一致。

* **在 dsh-vscode 内提供多轮视觉 QA（LibreOffice + Poppler + Chromium）**：这些重量运行时不属于嵌入式发行；QA 仅在开发环境（`npm run roundtrip`）可用，产品内降级为"仅导出 + 可选的校验报告"。

* **Python 依赖**：不使用 `extract-pptx.py`（python-pptx）路线；导入统一走纯 JS 的 docgen 导入。保持 dsh-vscode "用户机器零 Python / 零独立 Node" 约束（Node 由 VS Code 内嵌运行时提供）。

* **不修改 DSH 宿主内核**：沿用品类既有方式——新增自包含 DSH 插件 + 扩展宿主侧宿主工具桥接，不 fork/不 patch 官方 web profile。

### 1.3 前置事实（已核实）

| 组件                                            | 状态                | 证据                                                                                                                                                                                                                      |
| --------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@canglongcl/dsh-web-review` v0.5.0           | ✅ 已集成于 dsh-vscode | `plugins/bundled/@canglongcl/dsh-web-review/`（lib/ 预构建 + skills/better-ui + cordis.patch.yml）；`src/extension.js` `BUNDLED_PLUGINS` 已注册                                                                                  |
| web-review 自包含性                               | ✅ 无第三方重依赖         | `lib/index.js` 仅 import `node:*` 内建模块；`client.inject` 依赖均为 `@deepseek-ai/*`（宿主提供）                                                                                                                                       |
| `docgen-utils` (1.0.37)                       | 待引入               | npm 能力：`import pptx` / `export slides` / roundtrip + diff + report.json；导出基于内置 PptxGenJS（纯 JS）                                                                                                                          |
| `dsh-frontend-slides`（`frontend-slides` 技能移植） | 待引入               | 零运行时依赖技能插件；提供 STYLE\_PRESETS / 34 套 Bold 模板 / viewport-base.css / SKILL.md 设计方法论                                                                                                                                        |
| web-review 与 dsh-better-sidebar               | ✅ 已集成             | web-review README 声明：装 better-sidebar 后预览自动开在侧边栏                                                                                                                                                                        |
| 宿主 `webServer` 路由承载                           | ✅ 已具备（已核实）        | `src/extension.js` `DEFAULT_HOST_PORT=37750`、`BASE_BUNDLES`（base+web-app 提供 `webServer` 服务）；`@deepseek-ai/dsh-host-webserver` 暴露 `register({kind,path,handler})`；同仓库先例：recall `/api/recall`、better-sidebar `/sidebar/*` |

***

## 2. 架构总览

```
┌───────────────────────────  dsh-vscode 扩展进程  ───────────────────────────┐
│                                                                              │
│  ┌──────────────┐   fork+embed   ┌────────────────────────────────────────┐  │
│  │ extension.js │───────────────▶│  DSH web host (web profile)            │  │
│  │  BUNDLED_PLUGINS              │  ├─ @canglongcl/dsh-web-review (批注)  │  │
│  │  transplant / presets         │  ├─ dsh-better-sidebar (侧栏预览)      │  │
│  │  [新增] p2h 桥接工具(工具层)    │  ├─ dsh-frontend-slides (设计指导 skill)│  │
│  └──────┬───────┘                │  └─ …                                  │  │
│         │ ELECTRON_RUN_AS_NODE   └──────────────────┬─────────────────────┘  │
│         │ 新增: context_tool(“slides_convert”)       │ tool 调用               │
│         ▼                                           ▼                          │
│  ┌────────────────────────────┐        ┌──────────────────────────────┐      │
│  │ p2h 转换桥 (extension host │◀──────▶│ 工作区 .html-slides/          │      │
│  │  内运行的 Node 子进程，      │  import/ │   slide-N.html (docgen 方言)  │      │
│  │  捆绑 docgen-utils 纯JS依赖)│  export  │   index.html (预览入口)       │      │
│  └────────────────────────────┘        │   assets/ (图片/字体)         │      │
│                                         └──────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────┘
        用户视角：webview(DSH UI) 网页预览 Tab ←→ web-review 批注 ←→ 对话
```

### 数据流（一次完整往返）

```
1. [用户] 在对话中提供 .pptx 路径，或拖拽文件进输入框
2. [Agent] 调用 host 工具 slides_import(pptx) 
   └─ p2h 桥: docgen import pptx → 单文件 output.html → 按 .slide 边界切片成 slide-N.html
3. [Agent] 复用宿主 webServer 的 /html-slides 静态路由，把 index.html URL 交给 web-review（网页预览 Tab）
4. [用户] 网页预览中批注元素（悬停高亮→点击→写意见；可开视觉调整面板）
5. [批注] 带 选择器/文本/a11y 名/源码线索 注入当前会话输入框
6. [Agent] 依据批注修改工作区 slide-N.html 源码（<3> 路径B 经 frontend-slides 设计规则参考）
7. [用户] 对话中指示导出 → Agent 调 slides_export() 
   └─ p2h 桥: slide-N.html… → docgen export slides → 输出 .pptx（createIfAbsent 语义，不覆盖源文件）
8. [验收] 用户可再次导入导出的 pptx 对比，或本地跑 roundtrip 视觉 diff（开发环境）
```

***

## 3. 组件设计

### C1 转换桥 p2h（PPT↔HTML bridge，新增）

**职责**：把 docgen-utils 封装成可从 DSH agent 调用的 host 侧工具 + 可从扩展宿主侧 CLI 调用的小桥 + 对话侧业务界面（导入入口与导出产物卡片，见 §4）。

* **形态**：`src/p2h/` 目录，内含：

  * `convert.mjs` —— 纯 JS 转换入口（import / export / split / merge / serve），以子进程方式运行（`ELECTRON_RUN_AS_NODE=1`，与宿主同运行时，无需独立 Node）。产品内预览**不再走** `serve`（仅作为开发环境 roundtrip CLI 保留）；预览承载见 C3。

  * `tool-register.mjs` —— 作为 DSH host 工具暴露的封装；通过新增自包含插件 `@dsh-vscode/p2h-bridge`（cordis.patch.yml insert + index.js）注册 `slides_import` / `slides_export` 两个工具，数据走 tool/result；插件同时 `inject: ['webServer']`，在宿主 `webServer` 上注册静态预览路由 `/html-slides`（规格见下）。

  * client 面（新增，MVP「对话 + 轻量按钮」，布局见 §4.1）：`src/p2h/client/`，经插件 `client.inject` 挂两处——① composer dock 席位「导入 PPT」胶囊：点击 → 纯 JS 文件选择（复用 better-sidebar browse 后端）→ 输入框预填 `@<.pptx 路径>` 触发 agent 调 `slides_import`；② 消息内产物卡片：`slides_export` 完成后渲染 `xxx-modified.pptx` 卡片（\[打开] → better-sidebar `openFile`；\[在资源管理器中显示] → VS Code 扩展宿主桥）。界面机制先例：git-graph BranchChip（dock 胶囊）、web-review DraftOverlayBar（composer dock 注入）、file-review `ProducedFiles`（产物卡片）、web-review preview-link（消息内 HTTP 链接点击即开预览）。

  * 依赖：`docgen-utils` 及其第三方依赖**全部 vendored** 进 `vendor/node_modules`（纯 JS 子集，需在实现期核实依赖树里无原生 ABI）。

* **接口**：

  * `slides_import(pptxPath)` → `{ htmlDir, slideCount, reportUrl?, previewUrl }`（`previewUrl` = `http://127.0.0.1:<webServer.port>/html-slides/index.html`）

  * `slides_export(htmlDir, outPptx)` → `{ outPptx, warnings[] }`

  * 出错时返回结构化错误 + 部分产物清理，不产生半成品目标文件。

* **静态预览路由（已核实，见 §8 问题 3 的答案）**：插件在宿主 `webServer` 上执行 `ctx.effect(() => webServer.register({ kind: 'prefix', path: '/html-slides', handler }))`（`webServer.register` 为 `@deepseek-ai/dsh-host-webserver` 公开 API；同仓库先例：recall `/api/recall`、better-sidebar `/sidebar/*`）。handler 规则：仅 GET；根 = `hostCwd/.html-slides`（多根工作区取首个文件夹，可后续配置化）；`requireAbsolute + isWithin` 防路径穿越；MIME 按扩展名；`no-cache`；单文件 ≤ 20MB；**不设 sandbox CSP**（web-review 隔离预览代理会自动补 `frame-ancestors`，避免双 CSP 叠加把页面锁死）。已占用前缀核对（`/api/*`、`/sidebar/*`、`/git`、`/memory-evolve`、`/describe-image`、`/skills-manager`、`/super-injector/api` 等）：`/html-slides` 空闲，且 exact→最长前缀匹配顺序不遮挡既有路由。

* **降级路径**：MVP 阶段允许 p2h 桥以"开发机工具"形式存在（文档说明安装 docgen 方式），V2 再强制 vendored。

### C2 工作区 HTML 工程（.html-slides/）

**职责**：幻灯片 HTML 的物理组织与方言约束。

* 目录约定（仅限工作区内私有目录，不污染用户源树）：

  ```
  .html-slides/
    slide-1.html … slide-N.html   # docgen 方言，一页一文件
    index.html                    # 预览入口（iframe 顺序加载各 slide）
    assets/                       # 图片等侧载资源
    manifest.json                 # { slides: [{index,file,title}], sourcePptx, convertedAt }
  ```

* **方言约束（硬边界）**：所有 slide HTML 必须使用 docgen-utils 导出所期望的受限词汇（"Slide HTML"）。`frontend-slides` 的富 CSS（任意布局/动画/渐变）**不作为导出源**，仅作为设计指导。词汇表在实现「前」从 docgen 源码 `packages/slides/`（import/export 转换器 + test-data/slides 90 个样例）核实后固化到本 spec 附录 A。

* **split/merge 胶水**：docgen 导入得到单文件（全页拼接），按 `.slide` 顶层边界切片；导出前逆操作合并（或直接以 `--files` 喂给导出）。切片规则与 manifest.json 同步。

### C3 浏览与批注层（复用 web-review，零改动）

**职责**：给用户"选中元素 → 批注 → 注入对话"的交互。

* 预览承载：优先使用 `dsh-better-sidebar` 的「网页预览」Tab（web-review README 所述集成路径）；无 better-sidebar 时回退 web-review 自带内嵌浏览器。

* URL 来源（已核实，见 §8 问题 3 答案）：p2h-bridge 在宿主 `webServer` 上注册 `prefix /html-slides` 静态路由，预览 URL = `http://127.0.0.1:<webServer.port>/html-slides/index.html`（dsh-vscode 默认端口即 `DEFAULT_HOST_PORT=37750`，与 webview portMapping 同源同端口，天然可达；`src/extension.js`）。web-review 地址栏只接受绝对 HTTP(S) URL（`file://` 不入白名单），该 URL 直接满足，无需修改 web-review。

* 批注落点：web-review 已自动附带选择器/文本/可访问名/源码线索 → 正好命中 `slide-N.html` 的可编辑源码。无需修改 web-review。

### C4 设计知识层（引入 dsh-frontend-slides）

**职责**：为 agent 提供"好看"的设计决策依据，而不是产生不可转换的 DOM。

* 并入 `plugins/bundled/` 或独立 profile 插件，仅启用它的 skill 内容：

  * `STYLE_PRESETS.md`、34 套 Bold 模板（design.md + preview\.md）、`viewport-base.css` 的**设计原则条款**（密度模式、排版、色彩、防 AI slop 清单）。

* **使用边界**：agent 在改 `slide-N.html` 时参考这些规则，但**必须遵守 docgen 方言**（C2 硬边界）。禁止产出 docgen 方言之外的布局/动画再要求导出。

* 不启用 `extract-pptx.py`（Python）。

### C5 集成层（dsh-vscode 装配）

* `plugins/bundled/` 新增（一期）：`@dsh-vscode/p2h-bridge`（工具插件）；(二期)：`dsh-frontend-slides`（技能插件，零依赖）。

* `src/extension.js`：`BUNDLED_PLUGINS` 追加两项；p2h 桥的依赖若需 `_hostdeps` 则按现有 flatten 机制放置。

* `vendor/node_modules`：追加 docgen-utils 纯 JS 依赖子集（打包体积目标 ≤ \~2MB 增量）。

* `.smoke/pack.py` 无需改动（递归打包规则已覆盖新目录）。

***

## 4. 业务界面与用户旅程（验收用主路径）

### 4.1 界面布局（MVP：对话 + 轻量按钮，三个业务触点）

预览/批注主体**全量复用现有插件**，p2h-bridge 只新增两个对话侧触点：

1. **导入入口**：对话输入框上方的 composer dock 席位挂「导入 PPT」胶囊（client 注入；机制先例：git-graph BranchChip、web-review DraftOverlayBar）。点击 → 纯 JS 文件选择（复用 better-sidebar browse 后端）→ 输入框预填 `@<.pptx 路径>` → agent 调 `slides_import`。对话兜底：直接说"把这份 PPT 转成网页"或拖入输入框（composer 支持文件拖拽）。
2. **工作台主体（零新增）**：侧边栏「网页预览」Tab（web-review）——地址栏预填 `http://127.0.0.1:<webServer.port>/html-slides/index.html`（见 C3，agent 导入完成后自动带开），元素批注、发送注入对话均沿用现有交互。
3. **导出与产物**：对话指令或 dock「导出 PPTX」→ `slides_export` → 消息内渲染产物卡片 `xxx-modified.pptx`：\[打开]（better-sidebar `openFile`）/ \[在资源管理器中显示]（VS Code 扩展宿主桥）。机制先例：file-review `ProducedFiles` 产物卡片。

### 4.2 主路径

1. 打开 dsh-vscode 侧栏 → 对话输入框上方出现「导入 PPT」胶囊；
2. 点「导入 PPT」选择 `.pptx`（或说"把这份 PPT 转成网页让我改"/拖入输入框）→ agent 调 `slides_import`；
3. 导入完成 → Agent 消息内出现「打开预览」链接（web-review preview-link 机制，点击即开）→ 网页预览 Tab 打开 `index.html`（缩略图/翻页由浏览器/侧栏控制）；
4. 用户点「批注」→ 点目标元素 → 写"把标题字号调大、颜色改深"；
5. 发送 → 自动切回对话 Tab → Agent 修改 `slide-N.html`（必要时询问密度/风格）；
6. 用户点「导出 PPTX」或说"导出" → 消息内出现产物卡片 `xxx-modified.pptx`；
7. （可选）再次导入导出的文件，肉眼对比，重走 4–6 多轮。

***

## 5. 错误处理与降级

| 场景                                           | 行为                                                              |
| -------------------------------------------- | --------------------------------------------------------------- |
| 导入失败（损坏 pptx / 路径无权）                         | 结构化错误返回 agent；`manifest.json` 与输出目录保持不变；无半成品                    |
| 导出覆盖风险                                       | `createIfAbsent` 语义：目标存在则自动改名 `-N` 后缀，绝不覆盖源文件                   |
| 无 LibreOffice/Poppler/Chromium               | 产品内不做视觉 QA；导出功能照常（PptxGenJS 纯 JS）。QA 仅限开发环境 `npm run roundtrip` |
| 批注定位不到源码（选择器失效）                              | 沿用 web-review 既有兜底（a11y 名/文本/页面级线索），agent 按 C2 目录约定全量检索         |
| docgen 依赖含原生 ABI（实现期发现）                      | 整块降级为开发机工具（C1 降级路径），产品内提示用户本机安装 docgen 后使用                      |
| frontend-slides 与 web-review 的预览冲突（双 Tab 服务） | 明确分工：frontend-slides 只出"设计建议"，预览统一走 web-review/better-sidebar   |

***

## 6. 测试与验收指标

1. **冒烟（必过）**：vsix 打包后，webview 启动 → DSH 对话可评 → 网页预览 Tab 可开；
2. **主路径 E2E（必过）**：8 页含文本+图片+标题的样例 PPTX：
   `import → 预览可开 → 选元素写批注 → 对话注入含选择器 → agent 改字号/文案 → export → 产物可被 PowerPoint/WPS 打开`；
3. **保真基线（开发环境）**：docgen roundtrip 对同一 HTML：pixelDiff/SSIM/质量分 ≥ docgen 社区基线（target ≥85，实现期以 docgen `metrics.json` 实测为准）；
4. **方言合规（必过）**：`export slides` 前校验无方言外结构（自定义工具 `slides_check`），违规给明确错误定位；
5. **体积预算**：~~vsix 增量 ≤ 2MB~~ **实测修订（2026-08-30）**：vendored 子集（docgen slides 运行时闭包 + linkedom/jszip 全树 + 插件本体）≈ **6.8MB**——linkedom 解析器树与 pptxgen 本体即占 \~3.5MB，2MB 预估不成立；接受此增量（仍远小于一个 Chromium），如需回收可在后续版本裁剪 linkedom 的 css-select 分支或升级至按需打包。

***

## 7. 分期

### MVP（一期）

* C1 桥：`slides_import` / `slides_export` + split/merge + 宿主 webServer `/html-slides` 静态路由承载 index.html + client 面（导入胶囊 & 产物卡片，§4.1）；

* C2 `.html-slides/` 目录 + manifest + 方言附录 A 固化；

* C3 完整复用（零改动）；

* C5 装配：p2h-bridge 插件 + docgen vendored 入 vsix。

* 验收：主路径 E2E 通过。

### V2（二期）

* C4 frontend-slides 设计指导正式启用（MVP 可先不做）；

* 开发环境 roundtrip QA 脚本化 + 质量分回归门槛;

* 手动样式调整（改属性同步 HTML 源码）可选增强；

* `slides_check` 方言校验工具。

***

## 8. 开放问题（实现期先核实再定稿）

1. **docgen Slide-HTML 词汇表**：✅ **已核实（2026-08-30，实现记录见附录 A）**——docgen **import 的输出**不是 class 词汇表，而是纯 inline-style 方言：1280×720 px `position:relative` 画布 + `position:absolute` 子元素（`data-elementType="text|image|table|chart"`，px 几何、内联颜色、data-URI 图片）。已按此固化附录 A，并用 `.tmp-smoke` roundtrip 实测验证。
2. **docgen-utils 依赖树**：✅ **已核实（2026-08-30）**——5 个依赖全纯 JS，且 **playwright 只被** **`dist/cli.js`** **与 export-docs/export-slides 两个 CLI 命令 import**（库路径零引用），可直接剔除。实际 vendored 子集：`slides/{import-pptx,convert,fonts}.js` + `slides/vendor/pptxgen.js` + `shared/{zip-guard,dom-parser-shim,fonts}.js` + linkedom/jszip 全树 = **6.8MB**（超出 §6.5 的 2MB 预估，见该条修订）。注意两处上游补丁：① dist 相对导入无扩展名（`from "./fonts"`），裸 Node ESM 不可运行（官方包只兼容打包器）——vendored 副本已补 `.js`；② `importPptx` 是 **default 导出**非命名导出。
3. **web-review 预览 URL 形态**：~~实测~~ ✅ **已核实（2026-08-30）**——web-review 地址栏仅接受绝对 HTTP(S) URL（`plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js` 的 `normalizePreviewUrl` / `isPreviewableUrl`，`file://` 不入白名单，报「请输入有效的 HTTP(S) 网址」）；因此本地 HTML 必须走本地 HTTP 路由之一：

   * **主方案**：p2h-bridge 在宿主 `webServer` 注册 `prefix /html-slides` 静态路由，URL = `http://127.0.0.1:<webServer.port>/html-slides/...`（dsh-vscode 默认 37750；规格见 C1）。无需再起独立 `node:http` 服务（C1 `serve` 降级为开发 CLI）。

   * **对照路径（MVP 兜底，今天即可用）**：better-sidebar 的 `/sidebar/html/<sessionId>/<编码绝对路径>` 路由（`plugins/bundled/dsh-better-sidebar/lib/index.js`）已可服务工作区内 HTML（相对资源路径可保留解析）；限制：文件须在会话 cwd 内（工作区外如 Downloads 返回 403）、响应带 `sandbox allow-scripts …` CSP（无 allow-same-origin，与 web-review 批注桥的兼容需冒烟验证）、单文件 ≤ 20MB。
4. **导入保真样例抽测**：挑一份真实 PPT 跑 `import`，记录质量分与典型失真项，决定附录 A 需要放宽/收紧的规则。
5. **frontend-slides 与 web-review 同装的 Tab 协同**：技能只读不写预览的前提下，确认无冲突。
6. **composer dock 与产物卡片 API**（C1 client 面，实现期核实）：✅ **已核实并落地（2026-08-30）**——① dock 挂载 = `ctx.inject(['slots'], …)` + `slots.inject('conversation.input.dock', () => slots.register({name,id,order}, Component))`（git-graph 同款；seat props 携带 `session` + `input` 门面）；② 输入预填 = `props.input.setDraft('@<相对路径> …')`（web-review 批注提交同款 API，整段替换草稿）；③ **产物卡片零自研**：`slides_export` 的 `presentResult` 返回 `{card:'generic', kind:'edit', locations:[{path: outPptx}]}`，官方 `@deepseek-ai/dsh-client-ui-deliverables` 回合尾「Produced files」行自动渲染芯片（含 openFile）；④ 文件选择不需要 better-sidebar browse 后端——胶囊内置 `<input type="file" accept=".pptx">`，经 `POST /p2h-bridge/api/upload`（同源、文件名白名单、20MB 上限）落盘 `.p2h-uploads/` 后预填草稿。工具 schema 两处硬约束实测：`required` 出现时必须为 true（可选参数省略该键）；`defineTool` 在注册时即编译 schema（坏 schema 插件加载即抛错）。

***

## 附录 A：docgen import 方言（dialect v1，2026-08-30 实测定稿）

来源：`docgen-utils@1.0.37` 的 `dist/packages/slides/import-pptx.js` 输出 + `.tmp-smoke` roundtrip 实测。**导出解析器（p2h-bridge** **`lib/slides/dialect-parse.mjs`）与 agent 编辑都必须落在此方言内。**

| 维度    | 规则                                                                                                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 画布    | 根元素 `<div style="position:relative;width:1280px;height:720px;overflow:hidden;background:<色>">`；几何换算 **px ÷ (1280/10) = in**（128 px/in，非 96）、字号 **px × 72/128 = pt**；解析器按根宽动态推 scale，非 16:9 给 warning                                          |
| 文本    | `<div data-elementType="text" style="position:absolute;left/top/width/height(px);overflow:hidden">` 内若干 `<p style>`，行内 `<span style="font-size/…px;color;font-weight:bold">` 为 run；段落分隔→`breakLine`；`text-align`→对齐；`line-height`→lineSpacing |
| 形状    | 无 data-elementType 但带 `background`/`border-radius` 的绝对定位 div；`border-radius ≥ min(w,h)/2`→椭圆；rgba alpha→fill transparency；border→line                                                                                                         |
| 图片    | `<img data-elementType="image" src="data:…" style="position:absolute;…;object-fit:contain">`（或外层 wrapper 带 inner img）；data-URI 直通、相对路径读盘内联、http(s) 交由 docgen convert 层 fetch                                                                  |
| 表格    | `<table style="table-layout:fixed">` + `<col style="width:Npx">` + `<tr style="height:Npx">` + `<td style>`：导出按列宽/行高**摊平为逐格 shape**（colspan>1 降级）                                                                                             |
| 图表    | `data-elementType="chart"`（SVG 包装）：**v1 跳过 + warning**（无浏览器无法栅格化）                                                                                                                                                                             |
| 背景    | 根 style `background`：色→`{type:'color'}`、`url(...)`→`{type:'image'}`、gradient→**白底 + warning**                                                                                                                                                 |
| 首页字体块 | docgen 可在首个 fragment 前置 Google Fonts `<style>` 块——导出解析器跳过非容器首子元素                                                                                                                                                                              |
| 导出渲染  | 复用 docgen `convert.js`（`applyBackground`/`addElementsToSlide`，纯 Node）+ vendored PptxGenJS `nodebuffer`；LAYOUT\_16x9（10"×5.625"）与 convert 的裁剪常量一致                                                                                              |

## 实现记录（2026-08-30）

* **插件**：`plugins/bundled/@dsh-vscode/p2h-bridge/`（`lib/index.js` 装配；`lib/routes.js` `/html-slides` 静态 + `/p2h-bridge/api` 上传；`lib/tools.js` 两工具；`lib/slides/{import,export,dialect-parse}.mjs` 转换核心；`lib/client.js` 导入胶囊）；已注册进 `src/extension.js` `BUNDLED_PLUGINS`。

* **Vendor**：`plugins/bundled/_hostdeps/`（`docgen-utils` 裁剪版 + linkedom/jszip 全树，32 包）；`package.json` exports `"./*"→"./dist/*.js"`、依赖裁到 `linkedom+jszip`。

* **导出策略（替代浏览器 parse）**：docgen 自家 headless CLI 也是「浏览器只做 parse、Node 组装」；产品内无浏览器，故 parse 由方言解析器承担（见附录 A），组装层原样复用 docgen。

* **验证**（`.tmp-smoke/`，纯 Node + headless Edge）：

  * `test.mjs` 17/17 PASS——roundtrip（造 deck → import → export → re-import）+ 路由（静态/遍历拒绝/404/405/上传/路径与扩展名白名单）；

  * `verify.mjs` A/B/C PASS——真实 `defineTool` 运行时注册、导出→重导入内容保真（双 run 颜色/文字/圆角保留）、`shot-index.png`/`shot-slide1.png` 视觉复核（读图确认；期间修复首页 960×540 框架对 1280×720 画布的 `scale(.75)` 裁切缺陷）；

  * 全部 lib 文件 `node --check` 通过。

* **待真机冒烟**（§6.1/6.2，需重启 dsh-vscode 让 bundle 装配生效）：宿主启动后标签页可见、`slides_import` 返回 previewUrl 可在 web-review 打开、`slides_export` 产物可被 PowerPoint 打开。

### 真机反馈修正（2026-08-30 第二轮）

1. **交互形态改版**：用户反馈 composer dock 胶囊形式不佳 → **移除胶囊**，改为 **better-sidebar 标签页**（`ctx.get("betterSidebar").registerTab({id:"p2h-bridge:manager", title:"PPT", icon, order:70, single, component})`，web-review preview tab 同款机制 + `internal/status` watcher 兜插件加载时序）。标签页承载导入（文件选择→上传→导入）、预览（iframe + 打开预览）、导出（自动命名）、管理（上传列表/产物列表/转网页/引用到对话/删除）。
2. **`pathname of undefined`** **根因**：宿主 webServer dispatch 只传两参 `route.handler(req, res)`（`@deepseek-ai/dsh-host-webserver` lib/index.js L186），首版 handler 的第三参 `url` 恒为 undefined——本地冒烟假 ctx 自己构造了 URL 传入所以全绿、真机即炸。修正：**所有 handler 自行** **`new URL(req.url ?? '/', 'http://x')`**（各在产插件同款），冒烟 dispatcher 改为忠实两参契约防回归。
3. **管理 API 扩充**（`/p2h-bridge/api/*`）：`GET /state`（项目 manifest + uploads 列表 + previewUrl）、`POST /import`（工作区内 .pptx 相对路径，拒绝越界）、`POST /export`（复用 exportSlidesToPptx）、`POST /remove`（仅限 `.p2h-uploads/` 内 .pptx）。
4. **验证升级**：`.tmp-smoke/test.mjs` 27/27（两参 dispatch + 全端点 + createIfAbsent 链式命名）；`verify.mjs` 15/15（真实 defineTool 注册 / 内容保真 roundtrip / **manager tab 浏览器内 CJS harness 视觉复核**——真实 client.js 挂真 react 19 打真 API，340px 侧栏仿真截图确认布局）。

### 真机反馈修正（2026-08-31 第三轮）

1. **① 标签页 UI 重做**：改用平台 **DSW 设计变量**（`--dsw-alias-label-*`/`bg-layer-1`/`hairline`/`button-primary-fill`/`state-error-primary` 等，与 better-sidebar 同源），一次性注入样式表获得真 hover/active 态（按压 scale(.96)、精确属性过渡）、留白分组（无分隔线）、同心圆角（外 10 内 6+padding）、`tabular-nums` 数字徽章、ellipsis 截断。
2. **② 打开预览 → web-review 预览标签页**：`service.isTabEnabled("dsh-web-review:preview")` → `service.openTab({type, url})`（web-review `openPreviewUrl` 同款）；无集成时回退 `window.open`。harness 新增行为断言（verify C8）。
3. **③④ VS Code 内隔离预览不可用根因**：web-review 的预览 iframe 挂在**独立回环服务器**的随机 `*.localhost:<port>` Origin 上（实测会话 201、端口 8339）；VS Code 外壳 CSP `frame-src http://127.0.0.1:* http://localhost:*` 按 host 精确匹配，**拦掉** **`*.localhost`** **子域** → frame 加载失败 → bridge 握手超时 →「无法通过隔离预览加载」，元素选择（④）依赖该 bridge 故同根。修复：`shellHtml` CSP 增补 `http://*.localhost:*`（工作区 `src/extension.js` + 安装版扩展，**需重载 VS Code 窗口生效**）。浏览器路径不受影响（Chromium 按 RFC 6761 解析 `*.localhost`→回环）。

### 事故记录（2026-08-31 第四轮）：PS 5.1 重编码打补丁损坏扩展入口

1. **现象**：用户重载窗口后「插件启动失败」，回退重装 0.2.36。exthost.log 实锤：`src\extension.js:562 SyntaxError: Invalid or unexpected token`——第三轮给安装版 `src/extension.js` 打 CSP 补丁时用了 `Get-Content -Raw` + `Set-Content -Encoding UTF8`，**PS 5.1 的 Get-Content 对无 BOM 文件默认按 ANSI(GBK) 解码**，字符串里的 UTF-8 省略号 `…` 被解码成乱码再写回，吃掉闭合引号 → 扩展激活即语法崩溃。
2. **恢复与复打**：重装后 bundled 变回胶囊版但 **profile 副本未被动**（标签页版存活、宿主照常）。复打：CSP 用 **edit 工具**（UTF-8 安全）重打安装版；bundled `client.js` 用 `Copy-Item` 字节级复制恢复；两份文件过 `node --check` + 乱码扫描（`閳` 不存在、省略号计数两份一致 6）+ BOM 检查（无 BOM）。
3. **规程（长期有效）**：①改工作区外文件一律 edit 工具或 `[System.IO.File]::ReadAllText/WriteAllText(…, UTF8Encoding($false))`，**禁止 PS 5.1 Get-Content/Set-Content 重编码**；②字节级复制用 Copy-Item（安全）；③任何外部文件补丁后必须 `node --check` + 非 ASCII 关键串回归扫描，不过不许让用户重启。

### 正式打包 0.2.37（2026-08-31 第五轮）

1. **打包通道**：`python .smoke/pack.py`（vsce 不兼容 pnpm 扁平布局）→ `dsh-vscode-0.2.37.vsix`（125MB，35445 文件）。版本三处同步：根 `package.json` 0.2.37、`.smoke/meta/extension.vsixmanifest`（历史遗留 0.2.29 一并修正）、`@dsh-vscode/p2h-bridge` 0.1.0→0.2.0（description 从胶囊改为标签页模型）。
2. **transplant 指纹机制（本插件上线的正道）**：扩展启动时对 `plugins/bundled` 按「扩展版本 + 每个插件 package.json version」算指纹，存 `<profile>/node_modules/.dsh-baked-marker.json`；**任一版本变化即失效并强制重铺全部 bundled 插件**。因此装 0.2.37 后 profile 自动拿到标签页版，不再需要手工双写 profile/bundled。
3. **瘦身发现**：旧 vsix 携带 `plugins/node_modules`（19902 文件 / 408MB 未压缩），扩展与宿主源码**零引用**（运行面只用 `plugins/bundled`+`plugins/presets`+`vendor/node_modules`，bundled 插件自包含）——当前 pack.py 已排除，包体 240MB→125MB 减半。
4. **vsix 验证**（zip 内读原文）：manifest/pkg 版本 0.2.37、CSP 含 `http://*.localhost:*` 且无乱码、p2h-bridge lib 全套在包且 client.js 为标签页版（registerTab×4/DSW×32/openTab×3/dock×0）、无 .map、rg.exe 与 dsh CLI、presets 齐全、无 plugins/node_modules。全部 PASS。

### 追加内置 dsh-free-search（2026-08-31 第六轮 → 0.2.38）

1. **结论**：0.2.37 **不含** `dsh-free-search`（此前仅市场装入用户 profile）。0.2.38 内置：包拷入 `plugins/bundled/dsh-free-search`（0.4.17，6 文件 0.2MB，字节级复制）+ 名字加入 `src/extension.js` 的 **`BUNDLED_PLUGINS` 数组**（仅拷目录不够——`syncBakedPlugins` 按该数组同步 profile manifest 的 `dsh.profile.bundles`）。
2. **依赖核实**：唯一真实依赖 `@deepseek-ai/schemastery`——`vendor/node_modules/@deepseek-ai/schemastery` 存在，且 bundled 先例 `dsh-file-review` 依赖完全相同并正常工作；peer（dsh-settings/dsh-tools）由宿主 realm 提供。零额外打包需求。
3. **版本**：0.2.37 从未交付即被取代，已删除防误装；根 package.json 与 vsixmanifest Identity 同步 0.2.38。zip 内 10 项验证全 PASS（free-search 四件套、BUNDLED_PLUGINS 含名、版本、CSP、p2h 标签页、rg.exe、无 node_modules/map）。注意 vsixmanifest 校验正则须锚定 `<Identity` 的 Version（`PackageManifest Version="2.0.0"` 是 schema 版本号，正则会误抓）。

### VS Code webview 预览双根因击破（2026-08-31 第七轮 → 0.2.39）

用户装 0.2.38 后报错依旧「页面无法通过隔离预览加载」。0.2.38 的 frame-src 修复有效但只解决了第一层，真机暴露出**两个 webview 特有根因**：

1. **会话创建 403（主因）**：VS Code webview 的 port-mapping Service Worker 把 GUI 发出的请求**重发为无 Origin/Sec-Fetch-Site 的干净回环请求**（README「工作原理」明确依赖此特性通过 /api 信任边界）——web-review `previewSessionsHandler` 的 `requestOrigin` 守卫收到无 Origin 请求即 403。**修复**：守卫放行「干净回环形态」（无 origin + 无 sec-fetch-site + Host 为 loopback）并以 `http://${host}` 合成 parentOrigin——与 DSH /api 对干净回环请求的信任模型完全一致；跨源 Origin、远程 Host 仍 403。
2. **frame 被 frame-ancestors 拦（次因）**：webview 嵌套链 `vscode-webview:// → http://127.0.0.1:37750 → frame`，CSP frame-ancestors 校验**全祖先链**，隔离服务器只放行 GUI origin → 顶层 vscode-webview:// 祖先被拒。**修复**：4 处 CSP 改为 `frame-ancestors ${session.parentOrigin} vscode-webview:`（scheme-source 放行 webview 外壳）。bridge 层无需改（只校验直接 parent origin，嵌套安全）。
3. **注入器预检修复（工具债）**：`dev_reload_package` 预检硬编码 `lib/client.js`，无视 `exports["./client"] → client-official.js`，对预编译市场包误报阻断。修复：预检改从 `exports["./client"]` 解析客户端入口文件名。
4. **验证**（`.tmp-smoke/probe-webview-fix.mjs`，node:http 精确控制 Host；注意 undici fetch 不允许覆盖 Host 头，且 Node 不解析 `*.localhost`——直连 `127.0.0.1:<port>` + 原始 Host 头）：browser-style 201 ✓ / **sw-clean 201 ✓（原 403）** / frame 200 + `frame-ancestors http://127.0.0.1:37750 vscode-webview:` ✓ / bridge 注入 ✓ / 跨源 403 ✓ / DELETE 204 ✓，ALL PASS。pwsh Invoke-WebRequest 走系统代理会对 `*.localhost` 报假 502——探测一律用 curl/node 直连。
5. **部署**：workspace bundled（web-review index.js + 注入器 index.js）+ profile 副本 + 安装版 0.2.38 三处同步，`dev_reload_package` 热重载即生效（用户刷新 GUI 页面即可重试，无需重装）；`dsh-vscode-0.2.39.vsix`（125MB，11 项 zip 验证全 PASS）固化全部修复，0.2.38 已删除。
6. **再撞 BOM 坑一次**：PS 5.1 `Set-Content -Encoding UTF8` 改根 package.json 又写入 BOM——已用 node 无 BOM 重写修复。规程再次确认：**一切源文件版本号修改走 edit 工具或 node 脚本，PS Set-Content 只用于纯 ASCII 且显式 -Encoding 参数可控的场景**。

### 最后一层：vscode-file 祖先（2026-08-31 第八轮 → 0.2.40）

1. **用户提供的 webview DevTools 日志一锤定音**：`Framing 'http://<hash>.localhost:5769/' violates "frame-ancestors http://127.0.0.1:37750 vscode-webview:"`——补丁字符串在而框仍被拦；同日志 `parentOrigin=vscode-file%3A%2F%2Fvscode-app` 暴露真凶：iframe 型 webview 的**外层文档 origin 是 `vscode-file://vscode-app`**（工作台宿主），祖先链实为 `vscode-file://vscode-app → vscode-webview://<id> → http://127.0.0.1:37750 → frame`，第七轮只放行了后两者。
2. **修复**：4 处 CSP 改为 `frame-ancestors ${session.parentOrigin} vscode-webview: vscode-file:`。同日志还证实：**VS Code GUI 与浏览器共用同一个宿主实例（127.0.0.1:37750）**（此前"扩展随机端口 fork 独立宿主"的认知在单面板场景下不成立），且会话创建已在 webview 内成功（403 修复有效）——frame-ancestors 是唯一剩余层。
3. **验证**：probe-webview-fix.mjs ALL PASS，CSP 实测含 `vscode-webview: vscode-file:`；宿主热重载后用户**刷新 GUI 页面即可**（宿主进程同一实例，无需重载窗口）。
4. **版本事实**：用户已装 0.2.39（VS Code 安装新版即清旧目录）；`dsh-vscode-0.2.40.vsix` 固化完整 CSP（11→6 项关键验证 PASS），0.2.39 vsix 已删除。profile/已装 0.2.39 bundled/workspace 三处同步打补丁；marker=0.2.39 时 transplant 跳过、保留已打补丁的 profile 副本，装 0.2.40 则重铺完整的。

### 存储重构 + PPT 管理界面 + 导出保真（2026-08-31 第九轮 → 0.2.41）

用户三点需求：①存储按 `<工作区>/.ppt/<PPT名>/` 组织；②标签页升级为完整管理界面（可收缩预览 + 回退）；③HTML→PPTX 导出差异大，且**必须通用修复**——先查清是 docgen-utils 固有问题还是安装错误。

1. **保真度根因调查（通用性结论）**：差异**不是 docgen-utils 固有、也不是安装错误**，而是我们的方言解析器（dialect-parse.mjs）只生成了 docgen IR 的一个子集——docgen 的 convert.js **原生支持**渐变填充（`el.shape.gradient`/`background:{type:'gradient'}`）、旋转（shape.rotate/style.rotate）、box-shadow、charSpacing、custGeom；vendored pptxgen.js 的 `genXmlGradientFill` 直接产 OOXML gradFill。导入侧（import-pptx.js）把 pptx 渐变转成 `linear-gradient(<deg>deg,...)`/`radial-gradient(ellipse at x% y%,...)` CSS、图表转成**自家方言的内联 SVG**（data-elementType="chart" 包裹，柱状图 path/rect + line + text）——两端都是确定性方言，中间缺的只是逆向解析。
2. **导出保真升级（全通用，零 deck 特判）**：①`gradient.mjs` — CSS 线性/径向渐变 → pptx 渐变 IR（含关键词角度/缺省 stop 均分/rgba 透明度），背景与形状填充走原生 gradFill；②**图表 SVG 逆向重建**：docgen 图表 SVG（rounded path 柱、rect 柱、轴线、text 标签、rotate(-90) 轴标题）→ **原生可编辑 pptx 图形+文本**（ bars=roundRect/rect shapes、轴线=line、标签=text）——PowerPoint 里可直接改数值柱颜色文字；③box-shadow→outerShdw、transform:rotate→shape.rotate、letter-spacing→charSpacing、line-through→strike。svgBlip 图片走 pptxgen 自带 SVG 通道（2016+ 可显示）。
3. **存储模型 v2**：`.ppt/<deck>/` = 源 pptx + `html-slides/` + 导出 pptx；`.ppt/active.json` 活动指针；deck 名清洗（CJK 保留）；上传 createIfAbsent -N。**迁移幂等**：旧 `.html-slides/`+`.p2h-uploads/` 在首次 state 调用时自动折叠（`-modified` 归属原 deck、空目录清理）——用户真实数据 CSSA(7页) 已在线上自动迁移验证。路由：`/html-slides/*`=活动 deck 别名（web-review 兼容）+ 新增 `/p2h-bridge/decks/<deck>/*` 每 deck 预览；API v2：state(decks+active)/upload/import{deck}/export{deck}(默认写进 deck 文件夹)/setActive/remove{deck|deck+file}。**坑**：index.js 忘挂 registerDecksRoute → 每 deck 路由裸 404（无 JSON 体是"路由未注册"的特征信号，区别于处理器 JSON 404）。
4. **管理界面**：client.js 重写为完整 deck 管理器——多选上传（逐个自动转换）、deck 卡片列表（当前徽标/页数/大小/转换时间 + 打开预览/导出/设为当前/重新转换/引用/删除）、导出产物 chips、活动卡内嵌**可收缩预览**（▼收起/▶展开）+ **回退历史**（最多 10 层，←回退按钮）。
5. **验证**：单元（19 项：渐变解析/背景IR/形状渐变/阴影/旋转/strike/charSpacing/图表 SVG 重建几何）+ E2E（39 项全 PASS：deck 布局/别名+每deck路由/遍历防护/API v2/迁移/保真 XML 断言 gradFill×2+stops+bars+rotate+shadow/roundtrip 渐变 CSS 回归）。测试基建：`.tmp-smoke/vendor-hooks.mjs`（Node 24 `module.registerHooks` 把裸说明符映射进 `_hostdeps` 平铺目录——main 无扩展名需补 `.js`/`/index.js` 回退）；`Module._resolveFilename` 补丁**管不到 ESM**，必须用 registerHooks。
6. **部署**：profile + 安装版 0.2.39 bundled + workspace 三处同步，`dev_reload_package` 热重载（8 模块）即生效；`dsh-vscode-0.2.41.vsix`（125MB，8 项 zip 验证 PASS）。已知边界：复杂 agent CSS（flex/grid/外链字体）仍受限（方言边界，工具描述已声明）；任意 SVG 图片无 PNG 回退（pptxgen 直嵌 svgBlip，老版本 PowerPoint 可能空白）。

