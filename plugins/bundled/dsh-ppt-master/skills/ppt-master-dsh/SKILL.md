---
name: ppt-master-dsh
description: >
  PPT Master 的 DSH 工具集入口（配合 ppt-master-dsh 预设使用）。用工具而非命令行
  驱动「源文档 → 项目 → 八项确认 → 逐页手写 SVG → 质检 → 视觉闸门 → 导出 PPTX」
  这条流水线。当用户说「生成PPT」「做PPT」「制作演示文稿」「create PPT」
  「make presentation」「美化这份PPTX」时使用。
---

# PPT Master（DSH 工具集版）

本 skill 是**精简入口**：讲清每一步该调哪个工具、哪个关卡必须停下。

## 载荷根目录（下文所有相对路径都相对它）

```
${PAYLOAD_DIR}
```

上面这一行是上游完整载荷（`ppt-master`）的**绝对路径**。下文提到
`references/...` / `workflows/...` / `scripts/...` / `templates/...` 时，
都相对这个根 —— 需要读文件或拼命令时，用「根 + 相对路径」拼出绝对路径再用。
常用入口：

| 相对路径 | 内容 |
|---|---|
| `SKILL.md` | 上游完整流程（本文件的原始出处） |
| `references/executor-base.md` | 逐页手写 SVG 的规范 |
| `references/shared-standards.md` | SVG/PPTX 技术约束 |
| `references/modes/<mode>.md` | 叙事骨架 |
| `references/visual-styles/<style>.md` | 视觉风格 |
| `workflows/<name>.md` | 独立工作流 |
| `scripts/README.md` | 全部脚本的参数表 |

> **工具与 skill 的分工**：工具负责「把某一步做掉」（确定性操作），
> 下面的流程纪律负责「顺序、闸门、禁止事项」（判断性约束）。
> 纪律不能因为工具好用就跳过 —— 跳过它们产出的 PPT 会明显更差。

---

## 省 token 的操作纪律（直接影响成功率与耗时）

实测一次真实手机会话：**工具调用 359 次，其中 bash 205 次**，读文件就占了 110 次，
而且 `read` 工具一次都没用。下面几条能砍掉大半无效开销：

1. **读文件用 `read` 工具，不要 `bash cat/sed/head/tail`。**
   `read` 走文件通道，有行号和 offset/limit，还能被压缩策略正确裁剪；
   `bash cat` 的原文会作为命令输出整段进上下文，且不受这些保护。
2. **每个文件只读一次。** 把要用的规范一次读完（必要时用 `offset`/`limit` 分段），
   不要「读一点 → 做一点 → 再回头读同一份」。实测同一个参考文档被读了 3 遍。
3. **不要 `job_output` 长等。** 需要等后台任务时用默认（短）超时轮询几次，
   **不要** `wait: true` 配 240000/300000 —— 实测这会硬阻塞 4~5 分钟，用户会直接发火。
   先干别的，回头再收。
4. **文字度量一次传一批。** 量多段文字时用 `ppt_svg_metrics` 的 `texts: [...]`
   一次传完，**不要**一条一次。实测 22 次单条调用（平均输出 31 字符）纯属浪费。
5. **不要反复重试同一个失败安装。** 某个依赖在目标平台上装不上（Android 上的
   PyMuPDF / playwright 就是典型），试一次拿到结论就换路，不要 `pip install` 十几次。
6. **不要为了绕开一个报错就手写脚本循环。** 先看工具本身有没有覆盖这条路
   —— 例如渲染闸门在 playwright 缺失时会**自动回退** rsvg-convert，
   不需要你自己拼 `for f in *.svg; do rsvg-convert ...`。

---

## 第 0 步：环境体检（开工前一次）

调 `ppt_env`。它会报告选中的 Python 解释器、版本、各功能组缺哪些依赖。

- 若报缺依赖：把报告里的 `pip install ...` 命令**交给用户执行**，
  或征得同意后自己执行。本包不会自动安装任何东西。
- 若报告**找不到 Python**：照它给的**平台专属**指引做。Android/Termux 上
  没有系统级 Python，必须先 `pkg install python` 与编译工具链；
  别去 `find /` 翻，也别反复重试。
- 视觉闸门 `ppt_render` 首选 playwright；**装不上不用慌**，见下方第 7 步。

---

## 全局纪律（最高优先级，违反任一条即视为执行失败）

1. **串行执行** —— 步骤必须按序，上一步的产物是下一步的输入。非 ⛔ 的相邻
   步骤可以连续做下去，不必等用户说「继续」。
2. **⛔ BLOCKING = 硬停** —— 标了 ⛔ 的步骤必须完整停下等用户明确回复，
   **不得替用户做决定**。
3. **禁止跨阶段打包** —— 不得把后续阶段的活提前干了。
4. **禁止投机执行** —— 例如在 Strategist 阶段就开始写 SVG。
5. **禁止用 sub-agent 生成 SVG** —— 页面设计依赖完整上游上下文，必须由当前
   主 agent 端到端完成。
6. **逐页顺序生成** —— 全局设计上下文确认后，一页一页连续生成；禁止分批
   （例如一次 5 页）。
7. **每页复读 spec_lock** —— 生成每一页前重新读 `<project>/spec_lock.md`，
   颜色/字体/图标/图片只能来自它，不得凭记忆或临时编造。
   这是为了抵抗长文档下的上下文压缩漂移，也避免「每页都是卡片网格」的默认。
8. **SVG 必须手写，禁止脚本生成** —— 每一页由主 agent 直接写。
   写一个 Python/Node/shell 脚本批量产出 SVG 是**禁止**的，
   哪怕理由是「省 token」「先出草稿」「用户着急」。
   脚本生成路径曾在分支上试过并放弃：跨页视觉一致性依赖逐页手写时的完整上下文，
   生成器脚本复现不了。

> 语言：回复语言跟用户输入与素材语言走（用户明确要求除外）。
> `design_spec.md` 的**结构**（章节标题、字段名）始终用英文模板，内容值可用中文。

---

## 流水线

### 第 1 步 · 素材转 Markdown

**前提**：用户给了素材（PDF / DOCX / EPUB / URL / Markdown / 纯文字描述都算）。

- 文件或 URL → `ppt_convert`（`kind` = `pdf` / `doc` / `excel` / `ppt` / `web`）
- 只有题目没有素材 → 先走 `topic-research` 工作流，再回来。
- 已有 PPTX 想要它的内容 → `ppt_convert`（`kind` = `ppt`）；
  想要版式/几何数据 → `ppt_intake`。

### 第 2 步 · 建项目

`ppt_project`（`action` = `init`，`format` 默认 `ppt169`）
→ `ppt_project`（`action` = `import-sources`，**`move: true`**）

> 必须用 `move` 而不是复制：生成的 Markdown、原始 PDF/图片都要移进 `sources/`。
> 之后它们不再存在于原位置。

### 第 3 步 · 模板（可选）

- 用现成的 → `ppt_template_import` 导入。
- 直接填 PPTX 模板（不走 SVG）→ `ppt_fill`（`analyze` → `scaffold` →
  `check-plan` → `apply`）。走这条路时，第 4~7 步不适用。
- 都不用 → 跳过，走自由设计。

### 第 4 步 · Strategist（强制，不可跳过）⛔

**这是整条流水线唯一的确认闸门。**

先用 `ppt_project`（`action` = `info`）等手段掌握项目现状，然后提出
**八项确认**（画布/风格/配色/字体/图标/图片/页数节奏/图表），
**推荐值 + 等用户明确确认或修改**。

- ⛔ 在用户确认前，**不得**输出 Design Specification 与 Content Outline。
- 用户确认后，后续非 ⛔ 步骤（设计规格、逐页 SVG、讲稿、后处理）可以自动连续
  做下去，不必再逐段征求同意。
- 确认后的尺寸系统是 **px-only**：`result.json` 里的排版值原样写进
  `design_spec.md` / `spec_lock.md` / SVG，不做 pt 换算。

产出：`design_spec.md` + `spec_lock.md`。

### 第 5 步 · 图片获取（条件触发）

素材里有图片需求时才做：

- 分析现有图片 → `ppt_images_analyze`
- 搜图下载 → `ppt_image_search`
- AI 生图 → `ppt_image_gen`（单张给 `prompt`；批量给 `manifest`）
- 公式渲染 → `ppt_latex`
- 处理后重算图片事实 → 再跑一次 `ppt_images_analyze`

> 图片事实必须**用时重算**，不要依赖陈旧的 `image_analysis.csv`。

### 第 6 步 · Executor：逐页手写 SVG

先读规范（相对载荷根）：`references/executor-base.md` +
`references/shared-standards.md` + 锁定 mode 的**一个**文件 +
锁定 visual_style 的**一个**文件。**不要** glob 目录。

开工前：
- 输出关键设计参数（画布尺寸、配色、字体方案、正文字号）。
- 批量读一次 `spec_lock.page_layouts` / `page_charts` 引用的那些模板 SVG，
  每份只读一次，之后不再重读。

然后：**一页一页连续手写** → `<project>/svg_output/`。
每一页动笔前复读 `spec_lock.md`。

**质检闸门（强制）**：全部页面写完后、处理标注与讲稿之前，
调 `ppt_svg_quality`。任何 `error` 必须修好再往下（回到该页重写、重跑检查）。
`warning` 能顺手修就修，否则记下放行。
> 必须在 `svg_output/` 上跑，**不要**在 `finalize_svg` 之后跑 —— finalize 会重写
> SVG，把违规项盖掉。

再做讲稿：写 `<project>/notes/total.md`。

**含几何图形/数据图表的页面**：在动笔前把依赖点算准并做边界检查。
坐标算用 `ppt_svg_position`；文字宽度/是否溢出用 `ppt_svg_metrics`
（**多段文字一次用 `texts` 批量传**，别一条一次）。
AI 把数据映射到像素位置时经常有 10–50px 误差，先算再画能消掉这类错误。
> 只脚本化算术，SVG 本身仍然逐页手写。

### 第 7 步 · 后处理与导出

⚠️ 以下四步**一次做一个**，每步成功再进下一步；**禁止**合并成一条命令。

1. `ppt_notes_split` —— 拆分讲稿
2. `ppt_svg_finalize` —— 后处理 `svg_output/` → `svg_final/`
3. `ppt_svg_metrics`（`action` = `audit`）—— 安全底边与溢出审计
   （若 `spec_lock.md` 声明了安全底边，加 `safe_bottom`）
4. **视觉检查闸门（强制）**：`ppt_render` → `ppt_contact_sheet`
   - `ppt_render` 把 `svg_final/` 渲染成 PNG（playwright 优先；
     **不可用时自动回退 rsvg-convert，你不需要另想办法**）。
     改过的页用 `pages` 只重渲那几页。
   - `ppt_contact_sheet` 拼成一张总览图，**一次读图代替读 N 张**。
   - **逐页肉眼看过**才算过闸门。发现问题的页回到第 6 步重写、重渲。

最后导出：`ppt_export`（`source` 默认 `final`；`reveal` / `mode` 控制动画与模式）。

产出在 `exports/`：原生 pptx 是权威产物。

---

## 独立工作流（按需，相对载荷根的 `workflows/`）

| 需求 | 文档 |
|---|---|
| 美化既有 PPTX | `beautify-pptx.md`（配合 `ppt_beautify_identity`、`ppt_beautify_inventory`） |
| 建品牌 | `create-brand.md` |
| 建模板 | `create-template.md` |
| 自定义动画 | `customize-animations.md`（配合 `ppt_animation`） |
| 生成语音旁白 | `generate-audio.md`（配合 `ppt_narration`） |
| 实时预览 | `live-preview.md`（配合 `ppt_check_annotations`） |
| 精修规格 | `refine-spec.md`（配合 `ppt_spec_update`） |
| 断点续跑 | `resume-execute.md` |
| 填模板出片 | `template-fill-pptx.md`（配合 `ppt_fill`） |
| 选题调研 | `topic-research.md` |
| 图表校准 | `verify-charts.md` |
| 视觉回看 | `visual-review.md`（配合 `ppt_visual_review`；**仅用户明确要求时**） |

## 工具速查

| 工具 | 用途 |
|---|---|
| `ppt_env` | 环境体检（解释器、缺失依赖、补齐命令） |
| `ppt_convert` | PDF/Word/Excel/PPT/网页 → Markdown |
| `ppt_intake` | PPTX 吸取（画布/几何/表格/图表数据） |
| `ppt_pptx_to_svg` | PPTX 反解成 SVG |
| `ppt_project` | 项目 init / import-sources / validate / info |
| `ppt_icons` | 复制选定图标进项目 |
| `ppt_batch_validate` | 批量校验规范性 |
| `ppt_template_import` / `ppt_template_register` | 导入 / 注册模板 |
| `ppt_fill` | 直接填 PPTX 模板（analyze/scaffold/check-plan/apply） |
| `ppt_spec_update` | 改 spec_lock 配色/字体并传播到 SVG |
| `ppt_images_analyze` / `ppt_image_search` / `ppt_image_gen` | 图片事实 / 搜图 / AI 生图 |
| `ppt_latex` / `ppt_images_rotate` / `ppt_watermark_remove` | 公式 / 旋转 / 去水印 |
| `ppt_svg_quality` | SVG 质检闸门 |
| `ppt_svg_metrics` | 字体度量、溢出轨、几何审计（支持 `texts` 批量） |
| `ppt_svg_finalize` / `ppt_svg_extract_assets` | 后处理 / 抽素材 |
| `ppt_notes_split` | 拆分讲稿 |
| `ppt_render` / `ppt_contact_sheet` / `ppt_visual_review` | 渲染 / 总览图 / 视觉复核 |
| `ppt_animation` / `ppt_narration` | 动画配置 / 旁白音频 |
| `ppt_export` | 导出可编辑 PPTX |
| `ppt_beautify_identity` / `ppt_beautify_inventory` | 美化工作流前两步 |
| `ppt_svg_position` | 版面定位计算 |

> 所有工具都支持 `extra_args`（原样透传未建模的旗标）与 `cwd`（指定工作目录）。
> 需要某个脚本的完整旗标表时看载荷根下的 `scripts/README.md` 或直接读脚本源码。
