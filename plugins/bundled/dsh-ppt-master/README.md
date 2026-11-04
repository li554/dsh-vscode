# dsh-ppt-master

把 [PPT Master](https://github.com/hugohe3/ppt-master) 装成 **DSH agent preset** 的插件包：
选中「PPT Master」预设的会话里，直接多出 **32 个 `ppt_*` 工具** + 2 个 skill，
走 `源文档 → 八项确认 → 逐页手写 SVG → 质检 → 视觉闸门 → 导出可编辑 PPTX` 这条流水线。

**没选这个预设的会话完全不受影响** —— 工具不会出现，也不占任何上下文。

```bash
dsh plugin add dsh-ppt-master@1.0.6     # 建议写死版本
npm view dsh-ppt-master versions        # 查有哪些版本
```

> **为什么要写死版本号。** pnpm 有一个「新版本隔离期」(`minimumReleaseAge`，
> 默认约 24 小时）：发布不足隔离期的版本**不参与版本解析**。而所有版本都还在
> 隔离期内时，pnpm 在 loose 模式下会退回**最旧的那个版本**。
> 实测本包刚发 1.0.4 时，`dsh plugin add dsh-ppt-master` 与
> `@latest` 都装到了 **1.0.0** —— 而 1.0.0 的预设是坏的（见下方
> 「构造期必需 config」，卡片会显示「加载失败」）。写死版本号即可绕过解析。
> 这不是本包特有的问题，任何频繁发版的包都会这样。

装完之后新建会话，在预设选择器里选 **PPT Master**。

---

## 为什么做成预设，而不是常驻插件

DSH 的工具是**进程级**注册的：插件一旦启用，工具就出现在**所有**会话里。

这对通用插件是对的，对一个 32 个工具的专业流水线是错的 —— 每次聊别的，
`ppt_render`、`ppt_svg_metrics`、`ppt_watermark_remove`… 全都躺在工具表里，
每轮都在烧上下文、都在干扰模型选工具。

agent preset 正好解决这件事：预设是**会话级**的能力组装。本包的
`cordis.patch.yml` 里挂的是一行**声明**（官方 `@deepseek-ai/dsh-agent-preset`），
它描述「PPT Master 这个预设 = 这些插件」；工具行本身写在声明内部的 `plugins:`
列表里。于是装载动作、工具注册、系统提示词，全部发生在**选中该预设的会话**里。

> 顺带一提：这也让提示词可以随预设走。本包在预设里塞了 PPT 专用的 persona
> （八项确认是硬停、SVG 必须手写、视觉闸门必须看图），而不是把纪律硬编码进工具。

---

## 32 个工具

工具与 skill 是**互补**关系，不是替代：skill 负责**流程纪律**（哪一步必须停下、
什么不许做），工具负责**原子操作**（真的去跑那个脚本）。

| 阶段 | 工具 | 干什么 |
|---|---|---|
| 体检 | `ppt_env` | 探测 Python 解释器与 14 组依赖，报告缺什么 |
| ① 素材 | `ppt_convert` | pdf/doc/excel/ppt/网页 → Markdown |
| | `ppt_intake` | 素材入仓、登记来源 |
| | `ppt_pptx_to_svg` | 已有 PPTX → SVG（改造既有稿） |
| ② 项目 | `ppt_project` | `init` / `import-sources` / `validate` / `info` |
| | `ppt_template_import` `ppt_template_register` `ppt_icons` | 模板与图标库 |
| ③ 计划 | `ppt_spec_update` | 改 `spec_lock.md`（配色/字体/页序） |
| | `ppt_fill` | 模板填充：`analyze`/`scaffold`/`check-plan`/`apply` |
| | `ppt_images_analyze` `ppt_image_gen` `ppt_image_search` `ppt_latex` | 配图与公式 |
| | `ppt_images_rotate` `ppt_watermark_remove` | 图片预处理 |
| ④ 逐页 | `ppt_svg_quality` `ppt_svg_metrics` | 单页质检、文字宽度/排版度量 |
| | `ppt_svg_position` | 坐标/图表几何计算 |
| | `ppt_svg_finalize` `ppt_svg_extract_assets` | 后处理（每步单独跑） |
| ⑤ 收口 | `ppt_notes_split` `ppt_batch_validate` | 讲稿拆分、全量校验 |
| ⑥ 闸门 | `ppt_render` `ppt_contact_sheet` `ppt_visual_review` `ppt_check_annotations` | 渲染 → 拼图 → 逐页看图 |
| ⑦ 导出 | `ppt_export` | SVG → 可编辑 PPTX |
| 附加 | `ppt_animation` `ppt_narration` | 动画配置、AI 配音 |
| | `ppt_beautify_identity` `ppt_beautify_inventory` | 美化既有设计 |

所有工具都支持两个通用参数：

- `extra_args` —— 透传工具**没建模**的旗标，上游脚本加参数时不用等插件更新；
- `cwd` —— 指定工作目录。

返回统一是 `{ ok, exitCode, timedOut, output }`，`output` 是合并后的 stdout+stderr。

### 两个 skill

| Skill | 内容 |
|---|---|
| `ppt-master-dsh` | **精简入口**（6.7 KB）。流程纪律 + 每步该调哪个工具 + 卡住时看哪里 |
| `ppt-master` | **上游原文**（71 KB，未作修改）。`references/` 与 `workflows/` 是细节的唯一权威 |

---

## 为什么需要一个插件，而不是把目录丢进 `~/.agents/skills`？

因为 **DSH 不展开 `${SKILL_DIR}`**。

DSH 自带的 `@deepseek-ai/dsh-skill-filesystem` 只做发现与解析：扫磁盘上的 `SKILL.md`，
把 frontmatter 解析成目录条目，**正文原样返回**，不做任何变量替换。

而 PPT Master 的 `SKILL.md` 里有 **53 处 `${SKILL_DIR}`**：

```
python3 ${SKILL_DIR}/scripts/project_manager.py init <project_name>
```

在 Claude Code 里 `SKILL_DIR` 由宿主展开；在 DSH 里没有任何东西展开它。直接拷目录
进去，agent 拿到的就是字面量 `${SKILL_DIR}` —— 好在 filesystem provider 会同时告诉
它「Base directory for this skill」在哪，所以它猜得出来，只是文档与事实不符、要来回试错。

本插件在加载正文时把 `${SKILL_DIR}` 替换成**装好之后的真实绝对路径**，
于是文档里的命令行可以原样复制执行：

```
python3 C:/Users/<you>/.dsh/profiles/desktop/node_modules/dsh-ppt-master/skills/ppt-master/scripts/project_manager.py init demo
```

同一机制还提供了 `${PAYLOAD_DIR}`：指向上游载荷根目录，供精简 skill 做
「细节看原文」的跳转。展开是**运行时**做的，`skills/` 下的文件一个字节都没改。

### 只展开这两个，不动 `${TEMPLATE_DIR}`

`${TEMPLATE_DIR}` 是**运行时**由用户或 agent 自己赋值的模板来源路径
（`SKILL.md` 里写的是 `TEMPLATE_DIR=<user-supplied path>`），不是包能预先知道的值。
替换它会破坏语义，所以原样保留。

---

## 与手工安装的 skill 如何共存

skill 注册表按 rank 合并同名 skill，**数字小的赢**：

| Rank | 来源 | 路径 |
|---|---|---|
| 400 | `user-dsh` | `~/.dsh/skills` |
| 500 | `user-agents` | `~/.agents/skills` |
| **600** | **本插件**（默认） | 包内 `skills/ppt-master/` |

所以机器上**有** `~/.agents/skills/ppt-master` 时，**那份优先**，本插件静默让位，
不会出现两条同名 skill。这是刻意的：手工副本通常是你正在调试的版本。

实测（本机，两种配置各跑一次真实 registry）：

| 配置 | 胜出者 | 展开后残留 `${SKILL_DIR}` |
|---|---|---|
| 默认（rank 600） | `filesystem`（手工副本） | **53 处未展开** |
| `rank: 100` | `ppt-master`（本插件） | **0** |

**想让插件压过手工副本**：patch 只能按**顶层** id 匹配，预设内部的插件行
（`ppt-master-tools`）不在索引里 —— 按嵌套 id 覆盖会报
`patch: entry "ppt-master-tools" not found`。必须**整块替换预设的 config**，
把自己要保留的行原样带上（patch 语义是整块替换，不是深合并）：

```yaml
- id: preset-ppt-master
  config:
    id: ppt-master
    name: PPT Master
    order: 10
    plugins:
      # …把你想要的插件行照抄过来…
      - id: ppt-master-tools
        name: dsh-ppt-master
        config:
          rank: 100   # 小于 400，压过 ~/.dsh/skills 与 ~/.agents/skills
```

---

## Python 依赖

**插件永远不会自己跑 `pip install`** —— 那是有副作用的系统改动，必须你点头。

开工先调 `ppt_env`，它会报告解释器、版本，以及 14 组依赖各缺什么：

| 组 | 模块 / 命令 | 用在哪 |
|---|---|---|
| 核心（必需） | `pptx` `docx` `openpyxl` | 几乎所有环节 |
| 核心（原生扩展） | `PIL` `lxml` `numpy` | 图像、XML、数值 |
| SVG/PDF 转换 | `reportlab` `svglib` | 渲染与 PDF 处理 |
| PDF 解析 | `fitz` | PDF 素材 |
| 文档转换 | `mammoth` `markdownify` `bs4` `ebooklib` | 源文档转换 |
| 文档转换（`.ipynb`） | `nbconvert` | 笔记本转幻灯片 ⚠️ Android 不可用 |
| 网页抓取 | `requests` | 抓网页素材 |
| 网页抓取（强反爬） | `curl_cffi` | 微信等站点 ⚠️ Android 不可用 |
| YAML 配置 | `yaml` | 配置读写 |
| 视觉质检 | `playwright` | **视觉闸门首选** ⚠️ Android 不可用 |
| 渲染回退 | `rsvg-convert`（apt 包 `librsvg`） | **Android 上的唯一渲染后端** |
| 确认页 / 实时预览 | `flask` | SVG 编辑器 |
| AI 生图 | `google.genai` | Gemini 图片后端 ⚠️ Android 不可用 |
| 语音旁白 | `edge_tts` | AI 配音 |

> **Android 上 4 组永远装不上**（`nbconvert` / `curl_cffi` / `playwright` /
> `google.genai`，都缺 `android_arm64` 轮子）。这是平台事实，不是缺漏：
> `ppt_env` 会把它们单独标成「Android 不可用」，且**不计入 `ok` 判定** ——
> 否则任何一台手机上 `ok` 都恒为 false，模型会误以为环境没准备好而反复重试。
>
> ⚠️ **`pip` 是原子的**：同一条命令里只要有一个包构建失败，整条命令一个包都不装。
> 所以 `ppt_env` 给出的 pip 命令**已经把这 4 组排除掉了**，照抄即可，不要自己补。

缺哪组装哪个，`ppt_env` 会给出可直接复制的 pip 命令。完整清单：

```bash
pip install -r "<PAYLOAD_DIR>/requirements.txt"
```

### 用哪个 Python

按顺序探测：环境变量 `DSH_PPT_PYTHON` → `python` → `python3` → `py -3`，
并且**真的运行一次**打印版本才算数（光看 `where` 可能撞上 Windows 的
Microsoft Store 别名占位符）。

```powershell
$env:DSH_PPT_PYTHON = "C:\path\to\python.exe"
```

不想污染系统解释器就用 venv，把 `DSH_PPT_PYTHON` 指过去。

---

## 包结构

```
dsh-ppt-master/
├── package.json           # dsh.bundle.patch 指向 cordis.patch.yml
├── cordis.patch.yml       # 声明 agent preset「PPT Master」及其插件组成
├── lib/
│   ├── index.js           # 两个 skill 的 provider + 展开 ${SKILL_DIR}/${PAYLOAD_DIR}
│   ├── tools.js           # 32 个工具定义（参数 schema / 输出渲染 / argv 组装）
│   └── runner.js          # Python 探测、依赖体检、子进程执行
├── skills/ppt-master/     # 上游载荷原文（SKILL.md + scripts/references/templates/workflows）
├── skills/ppt-master-dsh/ # 精简入口 skill
├── verify.mjs             # 自检 81 项，零依赖
├── probe-load.mjs         # 真实 Cordis 装载冒烟测试
├── LICENSE                # 本包 MIT
└── LICENSE.ppt-master     # 上游 skill 的 MIT 许可（Hugo He）
```

### 为什么零 `peerDependencies`

一旦把 `@deepseek-ai/dsh-*` 写进 `peerDependencies`，安装时的
`evaluatePluginCompatibility` 就会拿它去卡运行时版本。而 DSH 的预发布版本号
（如 `0.1.6-alpha.1`）只匹配**同 `major.minor.patch` 且带预发布段**的区间 ——
`^0.1.6` 在 `0.1.6-alpha.1` 上判否，必然 `incompatible-version`。

本包因此**零依赖**：工具用 `ctx.tools.register()` 收的**普通对象**（不 import
`dsh-tools`）、`rank` 常量 600 硬编码、frontmatter 用 40 行自带解析器。
代价是那点重复代码，换来的是在任何 DSH 运行时上都能装。

### 为什么用 `spawn` 而不是 shell

工具直接 `spawn(python, [脚本绝对路径, ...argv])`，**不经 shell**。

PPT 的路径充满中文、空格、引号、`#`、`%`、`$`。拼成命令行字符串再交给 shell，
任何一个字符都可能变成注入或截断。传 argv 数组则完全绕开转义问题。
代价是不参与 DSH 的 sandbox/审批链 —— 可接受，因为这些命令是 skill 自带的
Python 脚本，不是模型现编的任意命令。

---

## 自检

```bash
node verify.mjs                        # 81 项静态契约 + 载荷 + 发布卫生，零依赖
node probe-load.mjs <profile>/node_modules   # 真实 Cordis 装载 + 真跑一次工具
```

`verify.mjs` 覆盖：插件契约（patch 在 `files` 里、声明行是 agent-preset、
预设内引用了本包、每个 group 都有 isolate 域、零 peer、构造期必需 config）、
载荷（两个 skill 的 frontmatter / 占位符展开 / 精简版确实更短）、工具定义
（32 个、名字不重复、`required` 不点幽灵键、未占保留名）、移动端适配
（渲染回退器在场且可被 `DSH_PPT_RSVG` 覆盖、Python 探测覆盖 Termux 前缀、
Android 有可执行安装指引、`pip` 命令可整条粘贴）、发布卫生（无本机路径
/ 无凭据 / 无 `.pyc`）。

`probe-load.mjs` 在真实 `Context` 上装一遍，断言工具全部注册、`ppt_env` 能跑出
解释器版本、`ppt_project` 能跑通完整 spawn 链路并如实返回非零。

### 为什么校验「构造期必需 config」

预设里的某一行如果**在构造函数里**校验 config（而不是用 Config schema），漏字段
的后果不是「该项被忽略」，而是**构造抛错 → 整行挂载失败 → 整份预设被 registry
标记 `broken`**：卡片显示红色「加载失败」，且该预设无法被选入会话。

1.0.0 就踩了这个坑：`plan-mode` 行没带 `config.section`，
`@deepseek-ai/dsh-plan-mode` 的构造函数抛
`PlanModeConfig needs a string `section``，整套工具随之报废。1.0.1 修好，
并在 `verify.mjs` 里加了针对这类「构造期必需 config」的回归断言
（去掉 `section` 立刻报 FAIL）。

判断某个包属于这一类：看它的 `lib/index.js` 里有没有
`XxxConfig needs a ...` / `XxxConfig: ... must be ...` 这种在构造路径上直接
读 `config` 的断言。用 Config schema 校验的包不在其列 —— 它们缺字段时会被
schema 补默认值或在加载期报清晰的 schema 错误。

---

## 移动端（Android / Termux）适配

这些能力来自一次真实手机会话的复盘（100.7 分钟、271 步、359 次工具调用）：

- **`ppt_render` 自动回退到 `rsvg-convert`。** 上游渲染闸门只走 playwright，
  拿不到就退出码 3；而 playwright 在 Android 上没有发行版
  （`pip install playwright` → No matching distribution）。现在
  `ppt_render` 检测到 playwright 路径不可用（退出码 3/127，或输出里含
  `Executable doesn't exist` / `playwright install` 等特征）时，自动用
  `rsvg-convert` 渲染到同一个 `inspection/` 目录，并在输出里标明
  `[回退]`。可用 `DSH_PPT_RSVG` 指定转换器路径。回退只在**确认是
  playwright 缺失**时触发 —— 别的非零退出码不会被它掩盖。
- **Python 探测覆盖 Termux。** 实测手机宿主进程**没有 `PREFIX` 环境变量**，
  只有 PATH 里带着 `…/termux/usr/bin`。所以候选表既从 `PREFIX` /
  `TERMUX_PREFIX` / PATH 反推前缀，也直接拼已知的
  `com.dsh.android` / `com.dsharnessmobile.shell` 私有目录。
- **平台专属的安装指引。** 找不到 Python 时，Android 上给出可直接抄的
  `apt-get install -y --no-install-recommends python python-pip`（而不是对手机说
  「安装 Python 3.10+」这种无法执行的话）。缺依赖时给出**按 apt / pip 分开的两条**
  命令，并说明哪些组在 Android 上本就没有轮子、不必反复重试。
  > ⚠️ **`--no-install-recommends` 不能省。** `python-pip` 的 `Recommends` 里写着
  > clang / make / pkg-config，apt 默认会一起把整个 LLVM（llvm/lld/libllvm）拖进来。
  > 真机实测同一条命令 **139 秒 → 16 秒**，且那堆东西对装依赖毫无用处。
  >
  > ⚠️ **原生扩展必须走 apt。** `pip install lxml`（或 Pillow / numpy / PyMuPDF）在
  > Android 上必然失败 —— PyPI 没有 `android_arm64` 轮子。Termux 仓库里有预编译包，
  > `ppt_env` 会直接给出对应的 `apt-get install` 命令。
- **`rsvg-convert` 是 Android 上唯一的渲染后端。** `playwright` 没有 Android 发行版，
  所以 `ppt_render` 必然走 rsvg 回退。它是**可执行文件**而不是 Python 模块，
  原先的体检只查 Python 模块、从不提示装它 —— 于是全新环境里两个后端都缺，
  视觉闸门整条断掉。现在 `ppt_env` 会探测 `rsvg-convert` 是否存在，
  并在 Android 上把它列入 apt 命令（包名 `librsvg`）。
- **`ppt_svg_metrics` 支持 `texts: [...]` 批量度量。** 单条调用一次要
  起一个 Python 进程；实测被单条调用了 22 次。批量走一个进程内联脚本。
- **精简 skill 内建省 token 纪律。** 实测 47% 的输出花在反复 `bash cat`
  上游 skill 文件上，而 `read` 工具一次未用。精简版 SKILL.md 直接写明
  用 `read`、每个文件只读一次、不要 `job_output` 长等、批量度量、
  不要手写渲染循环。

---

## 许可

本插件包：MIT（见 `LICENSE`）。

随包分发的 PPT Master skill：MIT，Copyright (c) 2025-2026 Hugo He
（见 `LICENSE.ppt-master`）。skill 载荷**未作修改**，路径展开发生在运行时。
