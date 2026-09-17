# dsh-archify

简体中文 | [English](#english)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-DeepSeek%20Harness-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![上游](https://img.shields.io/badge/移植自-archify-orange.svg)](https://github.com/tt-a1i/archify)

> **一句话：给 DeepSeek Harness 一个会画图的 agent 技能 —— 用 JSON 规格生成可验证的架构图、流程图、时序图、数据流图与生命周期图，输出独立 HTML。**

移植自 [`tt-a1i/archify`](https://github.com/tt-a1i/archify)（MIT，v2.14.0，官方 DSH 包 `@tt-a1i/archify-dsh@0.1.0` 同源同版本）。
技能本体（`archify/` 与 `examples/`）逐字保留，只适配了 dsh 的打包与命名。

## ✨ 功能

- 🗺️ **五种图型** —— architecture / workflow / sequence / dataflow / lifecycle，一个 JSON 规格对应一种
- ✅ **可验证** —— 提交前跑 `validate`，确定性校验给出 9 项验收（showcase）或基础验收（standard）
- 🌗 **深浅主题 + 视觉预设** —— classic 默认，signal-flow / blueprint / editorial 按需切换
- 📤 **多格式导出** —— 独立 HTML、PNG、SVG、WebM，以及 1200×630 分享卡片
- 🔀 **Mermaid 输入** —— 粘贴 flowchart / sequenceDiagram / stateDiagram，转为 Archify JSON 再美化
- 🔍 **架构对比** —— `compare` 两份快照，输出 Before / Delta / After 三态 HTML

## 📸 效果

给一个场景描述，agent 产出 JSON 规格并交付独立 HTML：

```
> 用 archify 画这个仓库的运行时架构，8–12 个核心组件，一条主路径，标出外部依赖与信任边界。

  write  runtime.architecture.json      ← agent 先写规格
  bash   node bin/archify.mjs validate architecture runtime.architecture.json --quality showcase
  bash   node bin/archify.mjs deliver architecture runtime.architecture.json runtime.html --quality showcase
  → 交付 runtime.html（深浅主题、可搜索、可分享）
```

## 📦 安装

```bash
dsh plugin --profile <你的 profile> add github:GongYuanCaiJi/dsh-archify
```

安装时会通过 `prepare` 脚本把 `archify/` 暂存为 `skills/`。若 pnpm 拦下构建步骤，在 profile
的 `pnpm-workspace.yaml` 里把本包加进 `allowBuilds`，再重跑一次。

从本地目录安装（需要先执行 `npm install` 触发暂存）：

```bash
git clone https://github.com/GongYuanCaiJi/dsh-archify.git
cd dsh-archify && npm install        # prepare 产出 skills/
dsh plugin --profile <你的 profile> add ../dsh-archify
```

环境要求：Node.js `^22.19.0 || >=24.0.0`，dsh `0.1.0-rc.6`。

## 🚀 用法

让 agent 按名字加载技能：

```text
Use the archify skill to map this repository's runtime architecture.
Show 8–12 core components, one primary path, external dependencies, and trust boundaries.
Put supporting detail in cards instead of adding more edges.
After delivery, return the exact workspace paths of the specification JSON and the HTML artifact.
```

卸载：

```bash
dsh plugin --profile <你的 profile> remove dsh-archify
```

**Produced Files 限制：** shell 命令生成的文件不会自动出现在 Web 端的 Produced Files 栏，
请让 agent 返回规格 JSON 与 HTML 工件的**精确工作区路径**，再从工作区打开（上游官方 DSH 包同样如此）。

**安全姿态：** 无遥测、无网络客户端、无凭据处理、无后台服务；没有 `install` / `postinstall` /
`preinstall` 生命周期钩子（仅 `prepare` 暂存技能文件）。

<details>
<summary>移植说明（对上游 <code>tt-a1i/archify</code> @ <code>archify-dsh-v0.1.0</code>）</summary>

逐字保留，`diff` 可验证：`archify/`（SKILL.md、renderers、schemas、bin、examples、recipes、
references、assets、delta、scripts、test）与根目录 `examples/` 全部为上游原文件。

**这一点你可以自己验，不必信我们** —— [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
钉住了上游 release tag、commit 与逐字文件的 SHA-256，附可直接复制的比对命令；
`test/zero-regression.test.mjs` 每次 `npm test` 都会重算比对。

适配处（上游官方 DSH 包 `@tt-a1i/archify-dsh@0.1.0` → `dsh-archify`）：
包名与解析路径改为 `dsh-archify`；新增 `prepare`（上游发预构建 tarball，git 安装需要
自行暂存 `skills/`）；上游仓库根目录的网站/发布文件（`docs/`、`README_EN.md`、
`README_ZH.md`、`benchmarks/`、`.github/` 等）不属于技能本体，未移植。

**已知限制：** 技能文案是英文 —— 那是上游原文，逐字保留未做翻译。
</details>

## 🛠 开发

```bash
npm install      # prepare 暂存 skills/archify
npm test         # adapter 测试 + 技能自身测试（golden + 全部自包含单测）
npm run test:skill   # 只跑技能测试
node scripts/pack.mjs --out /tmp/dsh-archify.tgz   # 本地打 tarball
```

`scripts/run-skill-tests.mjs` 会跳过 19 个无法在移植仓库运行的技能测试：18 个绑定上游仓库
根目录网站/发布文件的测试（`docs/`、`README_ZH.md`、`benchmarks/`、`ROADMAP.md`、
`.github/` 等，见文件内清单）加 1 个依赖 ajv devDependency 的
`generate-validators.test.mjs`（adapter 按上游安全姿态刻意保持零依赖；提交的
`generated-validators.mjs` 已由 THIRD_PARTY_NOTICES.md 钉住哈希并在每次 `npm test`
重验）。被跳过的测试文件本身仍在 `archify/test/` 原样保留。

## 📄 License

MIT。上游 [`tt-a1i/archify`](https://github.com/tt-a1i/archify)
`Copyright (c) 2026 tt-a1i (Archify)`，`Copyright (c) 2025 Cocoon AI`，
本移植 `Copyright (c) 2026 GongYuanCaiJi (dsh port)`。见 [LICENSE](./LICENSE)。

感谢 [tt-a1i](https://github.com/tt-a1i) 的原作者 —— 如果这个插件对你有用，
**也请去给[上游仓库](https://github.com/tt-a1i/archify)点个 star**。

---

## English

[简体中文](#dsh-archify)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-DeepSeek%20Harness-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Upstream](https://img.shields.io/badge/port%20of-archify-orange.svg)](https://github.com/tt-a1i/archify)

> **One line: a diagramming agent skill for DeepSeek Harness — turn a small typed JSON spec into a validated architecture, workflow, sequence, data-flow, or lifecycle diagram as a self-contained HTML artifact.**

A port of [`tt-a1i/archify`](https://github.com/tt-a1i/archify) (MIT, v2.14.0; same source as the official `@tt-a1i/archify-dsh@0.1.0`).
The skill payload (`archify/` and `examples/`) is byte-identical to upstream; only the dsh packaging and naming are adapted.

## ✨ Features

- 🗺️ **Five diagram types** — architecture / workflow / sequence / dataflow / lifecycle from one JSON spec
- ✅ **Verifiable** — deterministic `validate` with 9-check showcase or basic acceptance receipts
- 🌗 **Themes & presets** — dark/light plus signal-flow / blueprint / editorial visual presets
- 📤 **Exports** — standalone HTML, PNG, SVG, WebM, and 1200×630 share cards
- 🔀 **Mermaid input** — paste flowchart / sequenceDiagram / stateDiagram, re-author as Archify JSON
- 🔍 **Architecture compare** — `compare` two snapshots into Before / Delta / After HTML

## 📸 Effect

Describe a system, and the agent authors the JSON spec and delivers the HTML:

```
> Use the archify skill to map this repository's runtime architecture.

  write  runtime.architecture.json      ← agent authors the spec first
  bash   node bin/archify.mjs validate architecture runtime.architecture.json --quality showcase
  bash   node bin/archify.mjs deliver architecture runtime.architecture.json runtime.html --quality showcase
  → delivers runtime.html (dark/light, searchable, shareable)
```

## 📦 Install

```bash
dsh plugin --profile <your-profile> add github:GongYuanCaiJi/dsh-archify
```

The `prepare` script stages `archify/` into `skills/` on install. If pnpm blocks the build step,
add this package to `allowBuilds` in the profile's `pnpm-workspace.yaml` and re-run.

From a local directory (run `npm install` first to trigger staging):

```bash
git clone https://github.com/GongYuanCaiJi/dsh-archify.git
cd dsh-archify && npm install        # prepare stages skills/
dsh plugin --profile <your-profile> add ../dsh-archify
```

Requires Node.js `^22.19.0 || >=24.0.0` and dsh `0.1.0-rc.6`.

## 🚀 Usage

Ask the agent to load the skill by name:

```text
Use the archify skill to map this repository's runtime architecture.
Show 8–12 core components, one primary path, external dependencies, and trust boundaries.
Put supporting detail in cards instead of adding more edges.
After delivery, return the exact workspace paths of the specification JSON and the HTML artifact.
```

Uninstall:

```bash
dsh plugin --profile <your-profile> remove dsh-archify
```

**Produced Files limitation:** files created by shell commands do not automatically appear in
the Web Produced Files strip — ask the agent to return the **exact workspace paths** of the
specification JSON and the HTML artifact, then open them from the workspace (same as the
official upstream DSH package).

**Security posture:** no telemetry, network client, credentials handling, or background
service; no `install` / `postinstall` / `preinstall` lifecycle hooks (only `prepare` stages
the skill files).

<details>
<summary>Port notes (vs upstream <code>tt-a1i/archify</code> @ <code>archify-dsh-v0.1.0</code>)</summary>

Byte-identical, diff-verifiable: `archify/` (SKILL.md, renderers, schemas, bin, examples,
recipes, references, assets, delta, scripts, test) and the root `examples/` are upstream files.

**Verify it yourself — don't take our word** — [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
pins the upstream release tag, commit, and per-file SHA-256 with copy-paste compare commands;
`test/zero-regression.test.mjs` re-checks the pins on every `npm test`.

Adaptations (official `@tt-a1i/archify-dsh@0.1.0` → `dsh-archify`): package name and resolution
path; added `prepare` (upstream ships a prebuilt tarball; a git install must stage `skills/`
itself); upstream repo-root website/release files (`docs/`, `README_EN.md`, `README_ZH.md`,
`benchmarks/`, `.github/`, …) are not part of the skill payload and were not ported.

**Known limitation:** skill copy is English — that is upstream's original text, kept verbatim.
</details>

## 🛠 Development

```bash
npm install      # prepare stages skills/archify
npm test         # adapter tests + skill's own tests (golden + self-contained units)
npm run test:skill   # skill tests only
node scripts/pack.mjs --out /tmp/dsh-archify.tgz   # build a tarball locally
```

`scripts/run-skill-tests.mjs` skips 19 skill tests that cannot run in the port repo: 18
bound to upstream repo-root website/release files (`docs/`, `README_ZH.md`, `benchmarks/`,
`ROADMAP.md`, `.github/`, …; list inside the file) plus `generate-validators.test.mjs`,
which needs the ajv devDependency the adapter deliberately does not carry (upstream
security posture; the committed `generated-validators.mjs` is hash-pinned in
THIRD_PARTY_NOTICES.md and re-verified on every `npm test`). The skipped test files
remain untouched under `archify/test/`.

## 📄 License

MIT. Upstream [`tt-a1i/archify`](https://github.com/tt-a1i/archify)
`Copyright (c) 2026 tt-a1i (Archify)`, `Copyright (c) 2025 Cocoon AI`,
this port `Copyright (c) 2026 GongYuanCaiJi (dsh port)`. See [LICENSE](./LICENSE).

Thanks to [tt-a1i](https://github.com/tt-a1i) — if this plugin is useful to you,
**star the [upstream repository](https://github.com/tt-a1i/archify) too**.
