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

| 组件                                            | 状态                | 证据                                                                                                                                     |
| --------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `@canglongcl/dsh-web-review` v0.5.0           | ✅ 已集成于 dsh-vscode | `plugins/bundled/@canglongcl/dsh-web-review/`（lib/ 预构建 + skills/better-ui + cordis.patch.yml）；`src/extension.js` `BUNDLED_PLUGINS` 已注册 |
| web-review 自包含性                               | ✅ 无第三方重依赖         | `lib/index.js` 仅 import `node:*` 内建模块；`client.inject` 依赖均为 `@deepseek-ai/*`（宿主提供）                                                      |
| `docgen-utils` (1.0.37)                       | 待引入               | npm 能力：`import pptx` / `export slides` / roundtrip + diff + report.json；导出基于内置 PptxGenJS（纯 JS）                                         |
| `dsh-frontend-slides`（`frontend-slides` 技能移植） | 待引入               | 零运行时依赖技能插件；提供 STYLE\_PRESETS / 34 套 Bold 模板 / viewport-base.css / SKILL.md 设计方法论                                                       |
| web-review 与 dsh-better-sidebar               | ✅ 已集成             | web-review README 声明：装 better-sidebar 后预览自动开在侧边栏                                                                                       |

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
3. [Agent] 启动/复用预览服务，把 index.html URL 交给 web-review（网页预览 Tab）
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

**职责**：把 docgen-utils 封装成可从 DSH agent 调用的 host 侧工具 + 可从扩展宿主侧 CLI 调用的小桥。

* **形态**：`src/p2h/` 目录，内含：

  * `convert.mjs` —— 纯 JS 转换入口（import / export / split / merge / serve），以子进程方式运行（`ELECTRON_RUN_AS_NODE=1`，与宿主同运行时，无需独立 Node）。

  * `tool-register.mjs` —— 作为 DSH host 工具暴露的封装；通过新增自包含插件 `@dsh-vscode/p2h-bridge`（cordis.patch.yml insert + index.js）注册 `slides_import` / `slides_export` 两个工具，数据走 tool/result。

  * 依赖：`docgen-utils` 及其第三方依赖**全部 vendored** 进 `vendor/node_modules`（纯 JS 子集，需在实现期核实依赖树里无原生 ABI）。

* **接口**：

  * `slides_import(pptxPath)` → `{ htmlDir, slideCount, reportUrl? }`

  * `slides_export(htmlDir, outPptx)` → `{ outPptx, warnings[] }`

  * 出错时返回结构化错误 + 部分产物清理，不产生半成品目标文件。

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

* URL 来源：`index.html` 由 p2h 桥的本地 HTTP 服务（`node:http`，与 web-review 自身 server 同族）承载，或经扩展宿主端口映射。具体 URL 形态与端口分配在实现期以实测为准（见第 8 节开放问题）。

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

## 4. 用户旅程（验收用主路径）

1. 打开 dsh-vscode 侧栏 → DSH 对话；
2. 说"把这份 PPT 转成网页让我改"或拖入 `.pptx`；
3. Agent 导入 → 网页预览自动打开 `index.html`（缩略图/翻页由浏览器/侧栏控制）；
4. 用户点「批注」→ 点目标元素 → 写"把标题字号调大、颜色改深"；
5. 发送 → 自动切回对话 Tab → Agent 修改 `slide-N.html`（必要时询问密度/风格）；
6. 用户说"导出" → 得到 `xxx-modified.pptx`；
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
5. **体积预算**：vsix 增量 ≤ 2MB（docgen 纯 JS 子集 + 两个轻量插件）。

***

## 7. 分期

### MVP（一期）

* C1 桥：仅 `slides_import` / `slides_export` + split/merge + 本地 HTTP 承载 index.html；

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

1. **docgen Slide-HTML 词汇表**：从 docgen 源码 `packages/slides/` 与 `test-data/slides/` 90 样例提取可支持 class 清单/元素规则，固化为本 spec 附录 A（当前文档不臆测词汇）。
2. **docgen-utils 依赖树**：核实 5 个依赖全部纯 JS 可 vendored；否则按 C1 降级路径处理。
3. **web-review 预览 URL 形态**：实测 web-review 打开工作区 HTML 的 URL 与端口方案，确认 p2h HTTP 服务的对接点（或全部走 better-sidebar 预览 Tab）。
4. **导入保真样例抽测**：挑一份真实 PPT 跑 `import`，记录质量分与典型失真项，决定附录 A 需要放宽/收紧的规则。
5. **frontend-slides 与 web-review 同装的 Tab 协同**：技能只读不写预览的前提下，确认无冲突。

