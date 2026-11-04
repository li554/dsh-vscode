---
deck_id: math_middle_school
kind: deck
summary: 初中数学课堂讲义模板——方格纸底、墨蓝主色、琥珀强调，覆盖新授课全流程（封面→路线→章节→目标→探究→作图→定理→证明→练习→小结→作业→结束）。
keywords: [初中数学, 课堂讲义, 方格纸, 几何作图, 新授课, 探究式教学]
primary_color: "#1F4E79"
canvas_format: ppt169
page_count: 12
page_types: [cover, toc, chapter, content, ending]
replication_mode: standard
placeholders:
  01_cover: ["{{CHAPTER_NUM}}", "{{TITLE}}", "{{SUBTITLE}}", "{{AUTHOR}}", "{{DATE}}"]
  02_toc: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{Q1_TAG}}", "{{Q1}}", "{{Q2_TAG}}", "{{Q2}}", "{{Q3_TAG}}", "{{Q3}}", "{{PAGE_NUM}}"]
  02_chapter: ["{{CHAPTER_NUM}}", "{{CHAPTER_TITLE}}", "{{CHAPTER_DESC}}", "{{SECTION_NAME}}", "{{PAGE_NUM}}"]
  03a_content_objectives: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{OBJECTIVE_1}}", "{{OBJECTIVE_2}}", "{{OBJECTIVE_3}}", "{{PAGE_NUM}}"]
  03b_content_explore: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{EXPLORE_CONJECTURE}}", "{{PAGE_NUM}}"]
  03c_content_compass: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{PAGE_NUM}}"]
  03d_content_theorem: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{DEFINITION_TEXT}}", "{{SYMBOL_TEXT}}", "{{SYMBOL_NOTE}}", "{{PAGE_NUM}}"]
  03e_content_proof: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{PROBLEM_TEXT}}", "{{ANALYSIS_TEXT}}", "{{ANSWER_TEXT}}", "{{PAGE_NUM}}"]
  03f_content_drill: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{DRILL_1_TAG}}", "{{DRILL_1_TEXT}}", "{{DRILL_2_TAG}}", "{{DRILL_2_TEXT}}", "{{PAGE_NUM}}"]
  03g_content_summary: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{SUMMARY_HUB}}", "{{SUMMARY_HUB_SUB}}", "{{BRANCH_1_TITLE}}", "{{BRANCH_1_DESC}}", "{{BRANCH_2_TITLE}}", "{{BRANCH_2_DESC}}", "{{BRANCH_3_TITLE}}", "{{BRANCH_3_DESC}}", "{{BRANCH_4_TITLE}}", "{{BRANCH_4_DESC}}", "{{PAGE_NUM}}"]
  03h_content_homework: ["{{PAGE_TITLE}}", "{{SECTION_NAME}}", "{{KEY_MESSAGE}}", "{{HW_1_TAG}}", "{{HW_1_TEXT}}", "{{HW_1_NOTE}}", "{{HW_2_TAG}}", "{{HW_2_TEXT}}", "{{HW_2_NOTE}}", "{{HW_3_TAG}}", "{{HW_3_TEXT}}", "{{HW_3_NOTE}}", "{{CLOSING_MESSAGE}}", "{{PAGE_NUM}}"]
  04_ending: ["{{THANK_YOU}}", "{{ENDING_SUBTITLE}}", "{{CLOSING_MESSAGE}}", "{{CONTACT_INFO}}", "{{COPYRIGHT}}", "{{SECTION_NAME}}", "{{PAGE_NUM}}"]
---

# 初中数学课堂讲义模板 — Design Specification

## I. Template Overview

| Property | Description |
| -------- | ----------- |
| **Template Name** | math_middle_school（初中数学课堂讲义） |
| **Use Cases** | 初中数学新授课、复习课、习题讲评课；也可用于物理/化学等理科板书型课件 |
| **Design Tone** | 理性、清晰、可推导——像一张放大到投影上的方格纸讲义 |
| **Theme Mode** | Light theme（暖白方格纸底 + 墨蓝标题） |
| **Page Count** | 10 页（封面 / 路线 / 章节过渡 / 目标 / 概念 / 例题 / 练习 / 小结 / 作业 / 结束） |

**一眼识别点**：满页 40px 方格底纹 + 顶部 8px 墨蓝／4px 琥珀双色页眉条 + 页眉右侧的"坐标系锚点"（十字准星套实心点）——后者是本模板的记号，把"这一页属于第几节"表达成一个坐标点。

**设计动因**：方格纸是初中数学的真实媒介——坐标系、几何作图、函数图像、统计图表都长在方格纸上。网格同时给内容提供了一套天然对齐系统，让版面不依赖"随手摆"也能整齐；墨蓝承载理性与几何，琥珀只用于结论、重点与强调，投影环境下对比度足够。

## II. Color Scheme

| Role | HEX | Purpose |
| ---- | --- | ------- |
| **Background** | `#FCFCF9` | 页面底色（暖白，比纯白柔和，投影不刺眼） |
| **Grid line** | `#E9EDF2` | 方格底纹（每 40px） |
| **Grid major** | `#DCE3EB` | 方格加重线（每 200px，模拟坐标纸的粗格） |
| **Primary** | `#1F4E79` | 墨蓝——页眉条、页题、主强调、几何图形主色 |
| **Accent** | `#E08A2E` | 琥珀——结论、重点句、下划线、待求量标记 |
| **Secondary accent** | `#2E7D5B` | 松绿——正确性标记、答案、提示语 |
| **Body text** | `#1F2937` | 正文（近墨黑） |
| **Secondary text** | `#55606E` | 说明、副标题、引导句 |
| **Tertiary text** | `#8B95A3` | 页脚、出处、坐标轴与字母标注 |
| **Border** | `#D8E0E8` | 卡片描边、分隔线 |
| **Surface** | `#EDF2F7` | 次级面板底（引导条、思路卡、联系卡） |
| **Surface warm** | `#FDF3E6` | 琥珀系标签底 |
| **Surface green** | `#EDF7F1` | 松绿系标签底 |

**色彩纪律**：一页只用一种强调色做主视觉——琥珀留给"答案/结论"，松绿留给"提示/正确"，两者不同时大面积出现。几何图形统一用墨蓝描边 + `#EDF2F7` 淡填充，只有待求量/关键点用琥珀。

## III. Typography

| Role | Stack | 说明 |
| ---- | ----- | ---- |
| **Title / Body / Label** | `'Microsoft YaHei', 'PingFang SC', Arial, sans-serif` | CJK 领衔，投影清晰优先 |
| **Math / Figure label** | `Cambria, Georgia, 'Times New Roman', serif` | 数学量与字母标注（O、P、Q、α、β、∠1）走衬线斜体，贴近教材印刷体 |

- **Body baseline**: 24px（标题 48 / 引导 26 / 正文 22–24 / 卡片标签 20 / 提示 17–18 / 页脚 16）
- 全套堆栈以 Windows 预装字体收尾（Microsoft YaHei / Cambria / Georgia / Arial），无需嵌入字体。
- 数学符号（△ ≌ ∠ ∵ ∴ ° → α β）一律用 Unicode 原生文本，不使用图片公式。

## IV. Signature Design Elements

1. **方格纸底纹**（每页 `bg-grid` 组）：40px 细格 + 200px 粗格双层。实现为两个多子路径 `<path>`（`M0 40H1280M0 80H1280…`），导出为单个可编辑矢量形状，间距精确可控——刻意不使用 `<pattern>`，因为 PPTX 预设图案无法复现 40px 这种具体格距。
2. **双色页眉条**：顶部 `y=0..8` 墨蓝 `#1F4E79` + `y=8..12` 琥珀 `#E08A2E`。所有内容页统一，是整套课件的"装订线"。
3. **坐标系锚点**（`header-anchor`）：页眉右上角，`line` 十字 + 实心圆点，配节次文字。它是本模板区别于通用模板的记号。
4. **页题下划短线**：`M88 100H232`，6px 琥珀圆头——短促、不铺满，避免与方格线打架。
5. **几何图形规范**：三角形等图形统一 `stroke #1F4E79 width 2.5` + `fill #EDF2F7`；顶点实心圆 r=6；直角标记用两段短折线（非实心方块）；等角标记用弧线；字母标注走 Cambria 斜体、`#8B95A3` 或对应语义色。**所有几何图必须由 SVG 原语精确绘制，不用图片、不用 AI 生成**——数学准确性优先于观感。
6. **卡片语言**：白底 + `#D8E0E8` 1.5px 描边 + 12px 圆角 + 左侧 6px 语义色竖条（或顶部 5px 横条）。卡片一律不加阴影——方格纸是平的，阴影会破坏纸感。

## V. Page Roster

| File | Role | 版面与适用内容 |
| ---- | ---- | -------------- |
| `01_cover.svg` | cover | 左文右图。左上角墨蓝章节号胶囊；主标题 64px + 琥珀下划线；副标题、授课人、日期；右侧白卡内一幅坐标系＋三角形示意图（顶点 A/B/C、直角标记、α 角标记）。适合"第 N 章 章名 / 课题"封面。 |
| `02_toc.svg` | toc | **驱动问题页（面向学生）**。引导条 + 三张问题卡，每卡含编号圆、彩色标签胶囊（探究/作图/追问）与一个**待解决的驱动问题**（`Q1..3`）。三问分别指向性质、作图、证明，**均只提问不给答案**。这是本模板对"课堂导入页"的立场：学生需要的是问题，不是教师的教案目录——不放教学环节名（"探究一/复习引入"）、不放课时流程、不放教材页码。 |
| `02_chapter.svg` | chapter | 章节过渡页。左侧 8px 琥珀竖条 + "第 N 章"小字 + 60px 章名 + 分隔线 + 章说明；右侧一幅三角形示意图；右上角 250px 超大半透明章号（`fill-opacity 0.07`）作底纹，位于文字区右上方，不与图形重叠。 |
| `03a_content_objectives.svg` | content | **学习目标页**。引导句 + 左侧竖直虚线串起 3 个编号圆（墨蓝/松绿/琥珀）+ 右侧 3 条通栏目标卡（`OBJECTIVE_1..3`）。适合学习目标、要点清单、并列 3 条的任何内容。 |
| `03b_content_explore.svg` | content | **度量探究页（探究环节核心页）**。左侧大图卡：∠AOB 的平分线 OC 上取 P₁、P₂，分别作两边的垂线，标出垂足 D₁E₁D₂E₂、直角符号、等角弧；右侧上"量一量填一填"表格卡（两列空白待学生填数）+ 下墨蓝"猜想"卡（`EXPLORE_CONJECTURE`）+ 追问"量出来的相等，还需要证明吗？"。**这一页承担"从特殊到一般、度量—猜想"的探究功能，是新授课不可省的一环。** |
| `03c_content_compass.svg` | content | **尺规作图页**。左图卡画出完整作图痕迹：以 O 为圆心作弧交两边于 M、N，分别以 M、N 为圆心作弧交于 C，虚线作射线 OC；标出①②步骤序号与辅助连线。右侧上"步骤"卡（三步作法文字）+ 下"想一想"卡（为什么半径要大于 ½MN / 凭什么 OC 是平分线，含 SSS 依据）。**作图原理与操作并重。** |
| `03d_content_theorem.svg` | content | **概念/定理页**。页眉 + 引导条（`KEY_MESSAGE`）+ 上部通栏定义卡（`DEFINITION_TEXT`）+ 下部左右双卡：左"符号语言"（`SYMBOL_TEXT` + `SYMBOL_NOTE`，上下分栏对齐）、右"图形表示"（**完整的角平分线几何图**：∠AOB、平分线 OC、P 在两边的垂足 D、E、两处直角符号、两组等角弧）。 |
| `03e_content_proof.svg` | content | **例题精讲页（左图右析）**。左 512px 白卡放几何图；右侧三张卡自上而下：题目（琥珀竖条）、思路（灰底）、解答（松绿描边 + 大号答案）。适合例题、证明题、需要"图—分析—结论"三段推进的内容。 |
| `03f_content_drill.svg` | content | **课堂练习页（两栏带图）**。引导条 + 两张练习卡，**每卡内嵌精确绘制的几何图**（练习1：∠AOB 与直线 MN 相交；练习2：角平分线 + 双垂直 + F、G 点），题干在图上、下方留白作答。**刻意不设"提示/答案"槽位**——当堂练习的答案是学生要产出的东西，模板里不留位置就不会被误填成剧透。 |
| `03g_content_summary.svg` | content | **课堂小结页（中心辐射）**。中心墨蓝圆（`SUMMARY_HUB` + 副文字）向外虚线连四张分支卡（`BRANCH_1..4_TITLE/DESC`）。适合知识结构梳理、一节课的框架回收。 |
| `03h_content_homework.svg` | content | **作业布置页（分层三栏）**。引导句 + 三张分层作业卡（标签 + 题目 + 底部备注，`HW_1..3`）+ 底部墨蓝通栏"下节预告"条（`CLOSING_MESSAGE`）。建议分层为"基础题 / 拓展题 / 实践作业"，**避免出现"背默"类机械任务**。 |
| `04_ending.svg` | ending | 结束页。上部 72px 大号结束语（`THANK_YOU`）+ 琥珀下划线 + 副语；下部通栏墨蓝"下节预告"卡（`CLOSING_MESSAGE` + `CONTACT_INFO`）左右撑满、与页边距对齐；页脚版权与页码。 |

## VI. Assets

本模板**不打包任何位图资源**——背景纹理由 SVG 原语绘制，几何图形由 Executor 按题目精确绘制。这是刻意的：数学课件的图形必须与题干数值严格一致，任何预置插图都会限制准确性。

## VII. Placeholder Overrides

见 frontmatter `placeholders:`。偏离规范的两处，理由如下：

- **`{{CHAPTER_NUM}}` 同时出现在封面与章节页**：封面用"第几章"做角标胶囊，章节页用同一个值做超大半透明底纹数字，两处取同一个真值，避免章号写错。
- **`{{KEY_MESSAGE}}` 用于引导条**：本模板每页页眉下方都有一条引导条，承担"这一页要解决什么"的功能，语义上更接近 consulting 的 key message 而非普通副标题，因此沿用 `{{KEY_MESSAGE}}` 而非新增占位符。
- **`{{SECTION_NAME}}` 在页眉与页脚各出现一次**（页眉锚点旁 + 页脚左侧）：页眉的是当前节次，页脚的是同一节次的重复，方便学生随时定位；若不需要可只填一处、另一处留空。
