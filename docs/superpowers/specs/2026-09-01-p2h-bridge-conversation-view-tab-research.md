# p2h-bridge 脱离 dsh-better-sidebar 改造调研报告

> **归档说明**：这是 `explore/dsh-0.1.5-rc2` 分支把 p2h-bridge 从
> `dsh-better-sidebar` 标签页改挂到平台官方 slot `conversation.view`
> （`order: 15`，紧邻「轨迹」）时的调研记录，结论已落地在该分支代码里。
> 报告中的**行号**取自调研当时的文件快照（尤其是 `vendor/` 与
> `plugins/bundled/` 里的平台/插件产物），平台升级后可能漂移；引用前请以
> 当前文件为准。文中「调研开始时/结束时」的对照表保留了当时的中间状态
> （升级尚未完成），不是分支最终形态。

调研时间：本会话。仓库 `D:\PycharmProjects\Work\dsh-vscode`。

**重要环境事实（调研过程中发现仓库已被并发升级，本报告以此为准）**

| 项 | 调研开始时 | 调研结束时（现在） |
|---|---|---|
| `package.json` 的 `@deepseek-ai/dsh` | 0.1.1-rc.2 | **0.1.5-rc.2** |
| `vendor/node_modules/@deepseek-ai/*` | 0.1.1-rc.2 | **0.1.5-rc.2** |
| `plugins/bundled/@canglongcl/dsh-web-review` | 0.5.0 | **0.6.0** |
| `plugins/bundled/dsh-better-sidebar` | 存在 | **已删除** |
| `src/extension.js` BUNDLED_PLUGINS | 27 项 | **4 项**（`@canglongcl/dsh-web-review`、`@dsh-vscode/p2h-bridge`、`dsh-client-auto-continue`、`dsh-memory-evolve`，见 `src/extension.js:127-131`） |
| `plugins/bundled/@dsh-vscode/p2h-bridge` | 0.2.1 | **仍是 0.2.1（唯一未改造者，即本次任务）** |

所以：0.1.1 的事实用 npm 上的 `@deepseek-ai/*@0.1.1-rc.2` tarball 复核（解包在 `.tmp-smoke/research-p2h/v011/`），0.1.5 的事实直接引用**当前仓库** `vendor/` 与 `plugins/bundled/`（并另有 npm tarball 副本在 `.tmp-smoke/research-p2h/v015/`）。所有行号均来自 grep/read 工具输出。

---

## 第一节：p2h-bridge 现状对 betterSidebar 的完整依赖清单

文件：`plugins/bundled/@dsh-vscode/p2h-bridge/lib/client.js`（603 行）、`package.json`（26 行）、`cordis.patch.yml`（4 行）。

### 1.1 对 `betterSidebar` 服务的每一处调用

| # | 位置 | 代码 | 时机 |
|---|---|---|---|
| ① | `lib/client.js:41` | `const service = typeof ctx.get === "function" ? ctx.get("betterSidebar") : undefined;` | `watchBetterSidebar()` 的 `probe()`，在 `apply()` 里**同步立即执行一次** |
| ② | `lib/client.js:42` | `if (service !== undefined && service !== null && typeof service.registerTab === "function")` | 同上，作为「服务已就绪」的判定 |
| ③ | `lib/client.js:44-46` | `current = service; onEngage(service);` | 首次探测到服务 → 触发注册 tab |
| ④ | `lib/client.js:55` | `ctx.on("internal/status", listener);` | 监听平台插件状态变化，覆盖插件加载顺序（better-sidebar 可能在 p2h 之后才加载） |
| ⑤ | `lib/client.js:102` | `const service = ctx && typeof ctx.get === "function" ? ctx.get("betterSidebar") : null;` | `openPreviewUrl()` 内，每次点「打开预览」 |
| ⑥ | `lib/client.js:105-107` | `typeof service.isTabEnabled === "function" && typeof service.openTab === "function" && service.isTabEnabled("dsh-web-review:preview")` | 同上：探测 web-review 的预览 tab 是否存在且启用 |
| ⑦ | `lib/client.js:109` | `service.openTab({ type: "dsh-web-review:preview", url });` | 同上：把 `deck.previewUrl` 开进 web-review 预览 tab |
| ⑧ | `lib/client.js:562` | `return service.registerTab(descriptor);` | `registerManagerTab()`，由 ③ 触发 |
| ⑨ | `lib/client.js:572-593` | `const watcher = watchBetterSidebar(ctx, engage, disengage); ctx.effect(() => watcher.dispose, "p2h-bridge: sidebar tab watcher");` | `apply()` 主体 |

tab 描述对象（`lib/client.js:553-563`）：

```js
function registerManagerTab(ctx, service) {
  const descriptor = {
    id: TAB_ID,                    // "p2h-bridge:manager"  (line 542)
    title: () => "PPT",
    icon: e(ManagerTabIcon),
    order: 70,
    single: true,
    component: (props) => e(PptManagerTab, { ...(props || {}), ctx }),
  };
  return service.registerTab(descriptor);
}
```

`watchBetterSidebar` 本体在 `lib/client.js:36-65`。

### 1.2 用到的其它 ctx 能力 / 服务 / 注入项

| 能力 | 位置 | 说明 |
|---|---|---|
| `ctx.on("internal/status", …)` | `lib/client.js:55` | 唯一的事件监听 |
| `ctx.effect(fn, label)` | `lib/client.js:593` | 生命周期登记 |
| `ctx.get("sessions")` | `lib/client.js:364` | `referenceInChat()` 里 `sessions.scope(sessionId)`（`:366`） |
| `ctx.get("conversation")` | `lib/client.js:365` | `conversation.input.for(sessionCtx)`（`:367`）→ `input.setDraft("@… ")`（`:372`） |
| `scope?.sessionId` | `lib/client.js:225` | 来自 better-sidebar tab props 的 `scope`（**不是** slot 标准 kit） |
| `require("react")` | `lib/client.js:28` | 唯一的外部模块依赖（`window.__ModuleLoader__.load` 工厂） |
| 导出 | `lib/client.js:597-601` | `exports.PptManagerTab / openPreviewUrl / apply / inject = []` |

**当前 client.js 完全没有用到 slot（`ctx.slots`），也没有任何 `@deepseek-ai/dsh-client-ui-*` 的运行时 require。**

### 1.3 `package.json` 的 `dsh` 字段（`package.json:13-25`）

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "inject": [
      "@deepseek-ai/dsh-client-runtime",              // ← 0.1.5 中该包已不存在，必须替换
      "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-slots"
    ],
    "platform": "web"
  }
}
```

`dsh.client.inject` 的语义（证据：`vendor/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:145` `const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);`，以及 `lib/client.js:265-268` `for (const packageName of row.inject) { const dependency = this.graphRows.get(packageName); if (dependency !== void 0) await this.arriveGraphRow(...) }`）：
**它是「包名」列表，只用于保证这些包的前端模块先于本插件加载；不在图里的条目会被静默跳过（不会报错）。**

### 1.4 `cordis.patch.yml`（全文，4 行）

```yaml
# p2h-bridge bundle layer (mount shape mirrors dsh-recall-plugin / dsh-web-review).
- insert:
    - id: p2h-bridge
      name: "@dsh-vscode/p2h-bridge"
```

**结论：host 侧（`lib/index.js` / `routes.js` / `tools.js`）与 better-sidebar 无任何代码耦合**，只有 `lib/index.js:16-17` 一句注释提到 better-sidebar 的 `sessionCwdOf()` 约定。因此本次改造**只需改 `lib/client.js` 与 `package.json`，`cordis.patch.yml` 不动**。

---

## 第二节：web-review 的宿主机制与 0.5.0 → 0.6.0 变化

### 2.1 0.5.0：它**不是**宿主，只是 betterSidebar 的消费者（与 p2h 同类）

repo 里的 0.5.0 源码（本会话开始时读取，现已升级为 0.6.0）证据：

- `lib/client-official.js:5627-5655` `watchBetterSidebar(ctx, onEngage, onDisengage)`：`ctx.get("betterSidebar")`（`:5632`）+ `ctx.on("internal/status")`（`:5645`）。
- `lib/client-official.js:5791` `const PREVIEW_TAB_ID = "dsh-web-review:preview";`
- `lib/client-official.js:5797-5813` `registerSidebarPreviewTab()` → `engagement.service.registerTab(descriptor)`（`:5811`），descriptor 为 `{id, title, icon, order: 60, single: true, component, urlTarget}`
- `lib/client-official.js:5988-5993` 打开：`service.isTabEnabled("dsh-web-review:preview")` + `service.openTab({type: PREVIEW_TAB_ID, url})`
- `lib/client-official.js:6068-6082` 它**同时**注册了官方 slot `conversation.view`（id `"webview"`，order 20），但被 `registerViewContribution` **刻意在 betterSidebar 存在时卸载**（`:6083-6099`：engage 时 `viewDispose(); sidebarDispose = registerSidebarPreviewTab(...)`，disengage 时恢复）。

**所以：`dsh-web-review:preview` 这个 tab 是 web-review 自己通过 `betterSidebar.registerTab` 注册的，better-sidebar 只是宿主；web-review 和 p2h 是同一类消费者，区别只是 web-review 有官方的 `conversation.view` 兜底、p2h 没有。**

### 2.2 0.6.0：**彻底删掉 betterSidebar**，改为纯官方 slot

现在仓库里就是 0.6.0：`plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js`
（`betterSidebar` 匹配数 = 0；`registerTab` 匹配数 = 0）

- `:5561-5568` `const inject = ["slots","conversation","layout","locale","sessions","commandUi"];`（cordis 服务名，未变）
- `:5720-5735` 预览 tab 改为官方 slot：

```js
ctx.slots.inject("conversation.view", () => ctx.slots.register({
  name: "conversation.view",
  id: "webview",
  order: 20,
  label: () => t("view.tab"),
  locale: NS,
  store: webviewStore,
  inject: (sessionId) => ({ sendAnnotationsWithoutDraft, returnToChat, createPreviewSession, releasePreviewSessions })
}, WebviewView));
```

- `:5736-5755` 注释胶囊 dock：`ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({name:"conversation.input.dock", id:"webview-annotations", order:15, locale:NS, store:webviewStore, inject:(sessionId, actions)=>({ syncAnnotations, openPreview })}))`
- `:5264-5269` 新增 DOM 切 tab 工具（**可复用**）：

```js
function activateConversationTab(root, label) {
  const tab = [...root.querySelectorAll("[role=\"tab\"]")].find((c) => c.textContent?.trim() === label);
  if (tab === void 0) return false;
  tab.click();
  return true;
}
```

- `:5588-5596` `scopedConversation()` 用 `ctx.sessions.scope(sessionId).get("conversation")` 拿会话面。
- `package.json` 的 `dsh.client.inject` 去掉了 `@deepseek-ai/dsh-client-runtime`（该包在 0.1.5 不存在），保留 locale / commands / conversation / layout / primitives / slots。

### 2.3 关键结论：0.6.0 之后**外部无法再打开/预填 web-review 的预览 tab**

证据：

1. 0.6.0 的 `client-official.js` 全文只有 `:5561 const inject = [...]`，**没有任何 `ctx.provide(...)`**（grep `ctx.provide|provide\(` = 0 命中）→ 没有对外服务。
2. 预览 URL 的写入口只在 dock 条目的 inject face 里（`:5744-5753 openPreview`），只有 dock 组件能拿到。
3. store 是 apply 内局部创建（`:5701 const webviewStore = createWebviewStore();`），没有导出（`:5758-5765` 只导出 `NS, apply, createPreviewSession, inject, makeSyncAnnotations, releasePreviewSessions, setUiSkillDraft`）。

→ **替代预览方式：p2h 面板自己内嵌 iframe**。现有 `PreviewFrame`（`lib/client.js:179-214`）已经在做，且 `previewUrl` 是同源回环地址（`lib/routes.js:269-271` `http://127.0.0.1:<port>/p2h-bridge/decks/<deck>/html-slides/index.html`），换到对话区（比侧边栏宽得多）后 1280px 画布缩放效果更好。仅需把「打开预览」的语义从「开 web-review tab」改为「本面板内联预览 + 可选新窗口打开 / 复制链接」。

---

## 第三节：平台可用的官方挂载点（0.1.5-rc.2，带证据）

### 3.0 「轨迹」标签页是谁注册的？——`@deepseek-ai/dsh-client-ui-trajectory`，通过官方 slot `conversation.view`

`vendor/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js:8224-8249`：

```js
ctx.slots.inject("conversation.view", () => ctx.slots.register({
  name: "conversation.view",
  id: "trajectory",
  order: 10,
  locale: NS,
  label: () => t("view.trajectory"),
  children: { "conversation.trajectory.images": { kind: "single", scope: "session" } },
  inject: (sessionId) => ({ hooks: { duration }, loadOlder, loadImage, setActualDuration })
}, TrajectoryView));
```

（0.1.1 基线同样是这一句：`.tmp-smoke/research-p2h/v011/dsh-client-ui-trajectory/package/lib/client.js:7341-7344`，`ctx.slots.inject("conversation.view", …)` / `id: "trajectory"` / `order: 10`。）

**这个标签栏本身就是公开扩展点**——它就是 slot `conversation.view`（kind `list`，scope `session`）：

- 声明：`vendor/.../dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:157-161`
  ```ts
  'conversation.view': { kind: 'list'; scope: 'session'; owner: ConvViewOwnerProps; };
  ```
  0.1.1 同位置：`.tmp-smoke/research-p2h/v011/dsh-client-ui-conversation/package/lib/types/client/contract/slots.d.ts:117-120`
- 标签栏渲染（读 slot 账本）：`vendor/.../dsh-client-ui-conversation/lib/client.js:16542-16553`
  ```js
  const viewTabs = () => { const tabs = []; for (const entry of slots.entries("conversation.view")) { … tabs.push({ id: entry.options.id, label: resolveSlotLabel(entry.options.label) ?? entry.options.id }); } return tabs; };
  ```
  排序：list 条目按 `priority` 再按 `order` 升序（`dsh-client-ui-slots` `SlotCore.entries` 排序，0.1.1 版 `vendor`/0.1.5 版 `lib/index.js:122`）。
- 标签条 DOM：`vendor/.../dsh-client-ui-conversation/lib/client.js:15085-15097`（`role:"tablist"`，`tabs.map(...)`，点击 `selectView(viewTab.id)`）；只有 `tabs.length > 1` 才渲染（有 chat+trajectory 时恒真）。
- 内容区：`vendor/.../dsh-client-ui-conversation/lib/client.js:15124-15128` `renderSlot("conversation.view", { viewRequest, openView, completeViewRequest }, { only: active.id })`
- 默认选中项：`client.js:14979 DEFAULT_VIEW_ID = "chat"`、`14986-14987 resolveActiveView` → 新注册的视图**不会抢焦点**。

**现有 order 全表（0.1.5）**

| id | order | 来源 |
|---|---|---|
| `chat` | 0 | `vendor/.../dsh-client-ui-chat/lib/client.js:8290-8292` |
| `trajectory`（轨迹） | 10 | `vendor/.../dsh-client-ui-trajectory/lib/client.js:8224-8229` |
| `webview`（web-review 预览） | 20 | `plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js:5720-5723` |

→ 用 `order: 15`（或 11–19 任意值）即可**紧贴「轨迹」右侧**。

### 3.1 注册 API 签名（0.1.5）

服务 `ctx.slots` 现由 **`@deepseek-ai/dsh-client-ui-renderer`** 提供（0.1.1 由已消失的 `@deepseek-ai/dsh-client-runtime` 提供）：

- 0.1.5：`vendor/.../dsh-client-ui-renderer/lib/types/client/index.d.ts:26` `slots: SlotRegistry;`；类定义 `.../lib/types/client/registry.d.ts:46 class SlotRegistry`，`:84 readonly register: SlotCore['register']`，`:100 inject(key: keyof SlotMap & string, callback: () => SlotInjectionEffect): () => void`
- 0.1.1：`.tmp-smoke/research-p2h/v011/dsh-client-runtime/package/lib/types/client/index.d.ts:109 slots: import('./slots.ts').SlotRegistry;`，`.../slots.d.ts:46 class SlotRegistry`、`:74 readonly register`、`:90 inject(...)` —— **签名完全一致，未改名**。
- 纯核心契约（两版一致）：`register(options, component)` 两个重载，list 条目必须有 `id`、可选 `order` / `label`（`string | (() => string)`）/ `priority`（`dsh-client-ui-slots/lib/types/index.d.ts:562-577`（0.1.1）/ `:589-604`（0.1.5），`KindOptions` 定义 list 需要 `id`）。`ctx.slots.register` 是**原型方法**，靠 cordis service proxy 把 effect 记到调用者 fiber（registry.d.ts:67-83 注释）。

### 3.2 组件会收到什么 props（0.1.5）

`conversation.view` 是 `scope: 'session'`，组件 props = owner share + session 标准 kit + 全局 kit + (可选 inject face / locale `t`)。

- `vendor/.../dsh-client-ui-session/lib/types/client/index.d.ts:41-48`：
  ```ts
  interface SessionStandardProps { useSession; sessionId: SessionId; useProjection; }
  ```
  → **`sessionId` 是直接到达组件的标准 prop**（0.1.1 中等价声明在 `dsh-client-runtime`；`dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:345-350`）。
- `vendor/.../dsh-client-ui-conversation/.../contract/slots.d.ts:241-248` 追加 `useConversation` / `useInput` / `inputActions`。
- 0.1.5 的 owner share（`:288-295`）：`{ viewRequest, openView, completeViewRequest }`（**注意**：0.1.1 是 `{ inspect?, onInspectDone? }`，见 `v011/.../contract/slots.d.ts:405-412`）——不关心可忽略。
- 组件 props 里**没有 `ctx`**，`ctx` 必须由 `apply` 闭包捕获。

### 3.3 其它官方挂载点（0.1.5 新增/仍在）

| 挂载点 | 位置（0.1.5 证据） | 性质 |
|---|---|---|
| `conversation.view` | `dsh-client-ui-conversation/.../contract/slots.d.ts:157-161` | 对话区标签条（chat / 轨迹 / …） ← **本次目标** |
| `conversation.input.dock` / `.composer.dock` / `.input.left` / `.input.right` | 同上 `:186-211` | 输入区附加控件（web-review 的批注胶囊就在这里） |
| `conversation.session.header.actions` / `.utilities` / `.corner` | 同上 `:133-155` | 会话头部按钮 |
| `sidebar` / `sidebar.panellist` / `sidebar.workspaces` / `sidebar.settings` / `sidebar.footer.action` | `vendor/.../dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:21-73`（`sidebar.panellist` 为 **0.1.5 新增**，注释 `:36-43`「Each list id addresses the matching main panel」） | 左侧栏 |
| `main`（keyed）/ `rightbar` / `shell.overlay` | `vendor/.../dsh-client-ui-layout/lib/types/client/index.d.ts:28-84`（`'main'` keyed、`'rightbar'` single；**0.1.1 是 `'conversation'` / `'details'`**，见 `v011/.../client/index.d.ts:31/48/62/77`） | 中栏 / 右栏 / 全局浮层 |
| `sidebar.right.pane.tab`（keyed）/ `.title` / `sidebar.right.tab.guide`（chain）/ `.menu.item` / `rightbar.session` | `vendor/.../dsh-client-ui-sidebar-right/lib/types/client/contract/slots.d.ts:12-71` | **平台自带右侧栏的 tab 系统（better-sidebar 的官方对应物）** |
| `settings.section` / `settings.general.item` / `settings.plugin.item` | `vendor/.../dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:67-118`、`dsh-client-ui-settings-plugins/.../slot-contract.d.ts:19-23` | 设置页 |

右侧栏的两段式注册 API（0.1.5 新增）：

- `vendor/.../dsh-client-ui-sidebar-right/lib/types/client/index.d.ts:43-45`
  ```ts
  interface Context { sidebarRight: SidebarRightController; sidebarRightTabs: SidebarRightTabRegistry; }
  ```
- `.../tab-registry.d.ts:68-109` `SidebarRightTabDefinition { id, kind, patterns?, priority?, canOpen?, title(address), guide? }`；`:153 register(definition): () => void`
- `.../service.d.ts:118 openResource(address, options?)`、`:125 openTab(kind, options?)`
- 实际注册范式（自带 guide 类型）：`vendor/.../dsh-client-ui-sidebar-right/lib/client.js:3749-3762`
  ```js
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab", key: GUIDE_ID, children: {...}, inject: () => guideInjected
  }, GuideBody));
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: GUIDE_ID }, GuideTitle));
  ```

### 3.4 0.1.1 → 0.1.5 明确变更（逐条）

| 项 | 0.1.1-rc.2 | 0.1.5-rc.2 | 影响 |
|---|---|---|---|
| `@deepseek-ai/dsh-client-runtime` | 存在，提供 `ctx.slots`（`v011/.../index.d.ts:109`） | **npm 上无 0.1.5 版本（版本列表止于 0.1.1-rc.2）** | p2h 的 `dsh.client.inject` 必须去掉它 |
| `ctx.slots` 提供者 | `dsh-client-runtime` | **`dsh-client-ui-renderer`**（`.../index.d.ts:26`） | 注入包名替换 |
| `'conversation'` 顶层 slot | `dsh-client-ui-layout`（`v011/.../index.d.ts:48`） | **改名 `'main.conversation'`**（`dsh-client-ui-conversation/.../slots.d.ts:113`） | 直接占坑的插件会失效（p2h 不受影响） |
| `'details'` 顶层 slot | 存在（`v011/.../index.d.ts:62`） | **消失**，改为 `'rightbar'`（layout `:65`）+ `dsh-client-ui-sidebar-right` | 同上 |
| `conversation.view` owner props | `{ inspect?, onInspectDone? }` | `{ viewRequest, openView, completeViewRequest }` | 只影响读取 owner props 的组件；p2h 不用 |
| chat 视图归属 | `dsh-client-ui-conversation`（`v011/.../client.js:~10162` `name:"conversation.view"` / `id:"chat"` / `order: 0`） | **`dsh-client-ui-chat`**（`lib/client.js:8290-8292`） | order 仍是 0 |
| `conversation.view` 注册 API | 同 0.1.5（trajectory 0.1.1 vs 0.1.5 逐字对比一致） | 同 | **p2h 要用的 API 未变** |
| `slots.register` / `slots.inject` 签名 | 一致 | 一致 | 无风险 |
| `conversation.input.for(scope)` | 存在 | **仍存在**（`vendor/.../dsh-client-ui-conversation/lib/client.js:13410` 抛错文案） | p2h 的「引用」功能不受影响 |
| `sessions` 服务 | 存在 | **仍存在**，由 `dsh-api-session-controller` 提供（`vendor/.../dsh-api-session-controller/lib/client.js:3087 rootCtx.reflect.provide("sessions", this, void 0);`） | 同上 |
| 新增 | — | `@deepseek-ai/dsh-client-store`、`dsh-client-ui-renderer`、`dsh-client-ui-session`、`dsh-client-ui-chat`、`dsh-client-ui-sidebar-right`、`dsh-client-file-upload`、`dsh-api-*-controller` | — |

> 备注（非本任务但值得回传给主线）：当前 `vendor/node_modules/@deepseek-ai/` 里**没有 `dsh-client-ui-slots`**（0.1.1 时存在）。该包没有 `dsh.client` 字段（无前端半），运行时不影响浏览器模块图，但所有 `ui-*` 包的 `.d.ts` 都 `import type … from '@deepseek-ai/dsh-client-ui-slots'`；若仓库/发布链路里有任何 TS 校验或 `--types` 解析，需要把它补回 vendor。

---

## 第四节：候选方案与推荐

### 方案 A（推荐，符合「放在轨迹旁边」的硬要求）：注册官方 slot `conversation.view`

**改动文件：只有 2 个** —— `plugins/bundled/@dsh-vscode/p2h-bridge/lib/client.js` 和 `package.json`。`cordis.patch.yml`、host 侧（`lib/index.js` / `routes.js` / `tools.js`）**完全不动**。

#### A-1 删除（`lib/client.js`）

- 删 `:35-66` 整个 `watchBetterSidebar` region；
- 删 `:98-118` 旧 `openPreviewUrl` 内的 betterSidebar 分支（改写见 A-4）；
- 删 `:541-564` `tab registration` region 的 `registerManagerTab`（改用 A-3）；
- 删 `:566-595` 旧 `apply`（改用 A-5）。

#### A-2 `PptManagerTab` 取 sessionId 的方式要改

`lib/client.js:216` `function PptManagerTab({ scope, ctx })` 与 `:225 const sessionId = scope?.sessionId ?? null;`
→ 改成读 slot 标准 kit 的 `sessionId` prop：

```js
function PptManagerTab({ sessionId = null, ctx }) {   // sessionId 由 dsh-client-ui-session 合并进 SessionStandardProps
  ...
  const currentSessionId = sessionId ?? null;         // 供 referenceInChat 使用
```

（`referenceInChat`（`:362-377`）里的 `sessions.scope(sessionId)` / `conversation.input.for(...)` **逻辑不用改**，0.1.5 两个服务都还在。）

#### A-3 新的注册代码（可直接照抄）

```js
//#region conversation view tab (official slot, sits next to「轨迹」)
const VIEW_ID = "p2h";        // list slot 的 id，同时是 tab 的 key
const VIEW_ORDER = 15;        // chat=0 / trajectory=10 / ←15→ / webview=20

function registerPptView(ctx) {
  return ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: VIEW_ID,
    order: VIEW_ORDER,
    label: () => "PPT",       // tab 文案：string 或 () => string（lazy，跟随语言变化）
  }, (props) => e(PptManagerTab, { ...(props || {}), ctx })));
}
//#endregion
```

要点：
- `id` 必须全局唯一且不与内置冲突（现内置：`chat` / `trajectory` / `webview`）；
- 不需要 `icon`（对话区 tab 只渲染 `label` 文本，`client.js:15088-15097`）；
- 不需要 `locale`（`t` 是可选 seat；只写死中文标签可不注入 locale 服务）；
- 不需要 `inject` 业务面（`sessionId` 由标准 kit 给）；
- 不要用 `priority`（list 里 priority 是「同 id 遮蔽」用的，默认 0 即可）。

#### A-4 「打开预览」改写（web-review 预览 tab 已无法外部驱动）

```js
//#region preview opening (in-panel iframe is the primary surface)
function openPreviewUrl(url) {
  if (!url) return false;
  try { window.open(url, "_blank", "noopener"); return true; }
  catch { return false; }
}
/** Optional: focus an existing conversation tab by its visible label (web-review's own technique). */
function activateTabByLabel(label) {
  const tab = [...document.querySelectorAll('[role="tab"]')].find((n) => n.textContent?.trim() === label);
  if (!tab) return false;
  tab.click();
  return true;
}
//#endregion
```

- `previewDeck`（`:286-297`）里的 `if (openTab && deck?.previewUrl) openPreviewUrl(ctx, deck.previewUrl);` 改成继续走**面板内联** `PreviewFrame`（`:179-214`，`src = deck.previewUrl`），「打开预览」按钮语义改为「设为当前 + 展开内联预览」；可再给一个「在新窗口打开」按钮调 `openPreviewUrl(deck.previewUrl)`。
- 如需批注：可加「复制预览地址」+ `activateTabByLabel("预览")` 切到 web-review 的 tab（**注意**：0.6.0 无任何公开 API 能把 URL 灌进 web-review 的 store，用户需自行粘贴——这是本方案唯一的体验降级点）。

#### A-5 新 `apply`

```js
function apply(ctx) {
  injectStyles(document);
  ctx.effect(() => registerPptView(ctx), "p2h-bridge: conversation view tab");
  return undefined;
}
exports.PptManagerTab = PptManagerTab;
exports.openPreviewUrl = openPreviewUrl;
exports.apply = apply;
exports.inject = ["slots"];   // ← 关键：等待 ctx.slots 就绪（旧值 []）
```

#### A-6 `package.json` 的 `dsh.client.inject`

删掉 `@deepseek-ai/dsh-client-runtime`（0.1.5 不存在），改为（对齐 `dsh-client-ui-trajectory@0.1.5-rc.2` 的 `dsh.client.inject`，见 `.tmp-smoke/research-p2h/v015/dsh-client-ui-trajectory/package/package.json`）：

```json
"client": {
  "inject": [
    "@deepseek-ai/dsh-client-ui-conversation",
    "@deepseek-ai/dsh-client-ui-renderer",
    "@deepseek-ai/dsh-client-ui-session"
  ],
  "platform": "web"
}
```

（`@deepseek-ai/dsh-client-ui-slots` 没有前端模块行，留着会被 `graphRows.get()` 静默跳过，删掉更干净；`dsh-client-ui-conversation` 已注入 `dsh-client-ui-renderer`，写全更稳。）

#### A-7 改动量

| 文件 | 改动 |
|---|---|
| `lib/client.js` | 删除 ~45 行（`:35-66`、`:541-564`）、改写 `:99-118`、`:216`、`:225`、`:286-297`、`:566-600` ≈ 净减 40 行；新增 ~15 行注册代码 |
| `package.json` | `dsh.client.inject` 换 1 项、补 1 项 |
| 版本号 | 建议 `0.2.1` → `0.3.0`（形态变化） |

#### A-8 风险点

1. **必要前置**：`conversation.view` 由 `dsh-client-ui-conversation` 声明；若该插件未加载，`ctx.slots.inject` 会一直等待（不报错、不渲染）——但它是 web 必备包，实际不会发生。
2. 标签条仅在有 2 个以上 view 时出现（`client.js:15085`），有 chat + 轨迹恒成立。
3. 组件 props 里没有 `ctx`：务必用闭包传入（上面已示范）。
4. `id` 冲突会**抛错**（list 槽同 id 同 priority 二次注册会 throw，见 `dsh-client-ui-slots/lib/types/index.d.ts` register 注释）—— hot reload 时若旧注册未 dispose，用 `ctx.slots.inject` 的 effect 包裹即可随 fiber 卸载。
5. 如果 `p2h-root` 的 `height:100%` 在 `.viewArea` 下被拉伸：`.viewArea` 是 flex 容器（`ConversationRoot`），现有样式（`lib/client.js:128` `.p2h-root{display:flex;flex-direction:column;height:100%;overflow-y:auto}`）可直接用。
6. 预览降级：见 A-4 第 3 点。

---

### 方案 B（备选，最接近 better-sidebar 的官方形态）：平台自带右侧栏 tab

**挂到哪里**：右栏（`main` 的 `rightbar` 列），tab 与其它右栏 tab 并列，**不在轨迹旁边**，但它是 better-sidebar 的正统替代。

**注册（两段式，照抄 `ui-sidebar-right` 自带 guide 的写法）：**

```js
exports.inject = ["slots", "sidebarRightTabs", "sidebarRight"];

const DEF_ID = "@dsh-vscode/p2h-bridge";

function apply(ctx) {
  injectStyles(document);
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DEF_ID,
    kind: "p2h-ppt",
    priority: "extension",
    title: () => "PPT 管理",
    guide: [{ order: 40, title: () => "PPT 管理", description: () => "导入 / 预览 / 导出 PPT" }],
  }), "p2h-bridge: right-sidebar tab type");

  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: DEF_ID,                       // key = definition.id
  }, (props) => e(PptManagerTab, { ...(props || {}), ctx })));

  // 打开：ctx.sidebarRight.openTab("p2h-ppt")
}
```

证据：`vendor/.../dsh-client-ui-sidebar-right/lib/types/client/index.d.ts:43-45`（`ctx.sidebarRight` / `ctx.sidebarRightTabs`）、`.../tab-registry.d.ts:68-109`（definition 结构）、`:153`（`register`）、`.../service.d.ts:118/125`（`openResource` / `openTab`）、`.../contract/slots.d.ts:26-31`（`sidebar.right.pane.tab` keyed）、`.../lib/client.js:3749-3762`（官方自己的注册范式）。

**成本/风险**：改动量与 A 相当，但要注入 3 个服务；`tabInfo` hook、`navigation.params` 这些概念需要少量适配；`sessionId` 从 `useSidebarRightTabInfo()` 的 `tab`/`hooks.tabInfo` 拿（不是标准 kit），需要额外写几行。**新增依赖 `@deepseek-ai/dsh-client-ui-sidebar-right`**（它不在当前 4 个内置插件里，但属于平台 web 必备包）。

---

### 方案 C（备选，整页大面板）：`sidebar.panellist` + `main` keyed

**挂到哪里**：左侧栏多一个图标行 + 中间主区一整页（`main` 键控槽的 `p2h` 键）。适合「PPT 管理器要大面积、要并排预览+列表」。

```js
ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "p2h" }, PptMainPanel));
ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
  name: "sidebar.panellist", id: "p2h", order: 40, label: () => "PPT",
}, PptPanelIcon));
// 切换：ctx.layout.selectPanel("p2h")
```

证据：`vendor/.../dsh-client-ui-layout/lib/types/client/index.d.ts:48-51`（`'main'` keyed，注释「The reserved `conversation` key hosts the Conversation; other keys receive no Session binding」）、`vendor/.../dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:39-43`（`sidebar.panellist`，list id 与 main panel key 对齐）+ `:129-144`（`SidebarRootInjected.selectPanel`）。

**风险**：`main` 的其它 key **没有 session 绑定** → PPT 面板拿不到 `sessionId`，`referenceInChat`（依赖 session scope）需改用 `ctx.sessions.list.getSnapshot().current` 自行解析；改动量明显大于 A；且**不满足「在轨迹旁边」**。

---

### 推荐

**方案 A**。

理由：
1. 用户硬要求「放在轨迹标签页旁边」——`conversation.view` 就是那条标签栏，`order: 15` 精确落在 `trajectory(10)` 与 `webview(20)` 之间；
2. 它是平台**一等公民扩展点**（轨迹自己就用它），0.1.1 → 0.1.5 **签名与语义均未变**（两版 trajectory 逐字一致），升级风险最低；
3. 改动面最小：只动 `lib/client.js` + `package.json` 各一处，`cordis.patch.yml` 与 host 侧零改动；
4. 顺带彻底摆脱对第三方 side-bar 的运行时探测（不再需要 `ctx.on("internal/status")` 轮询）；
5. 唯一降级点是「点按钮直接调起 web-review 批注预览」——0.6.0 起已无公开 API，任何方案都无法恢复；用面板内联 iframe + 新窗口打开兜底即可。

若后续用户想要「像旧 better-sidebar 那样的右栏工作台」，再增量做方案 B（两者可共存：同一个 `PptManagerTab` 组件可同时注册到 `conversation.view` 与 `sidebar.right.pane.tab`）。

---

## 附：复核用临时产物（全部在 `.tmp-smoke/research-p2h/`，未改动仓库任何文件）

- `v015/` — `@deepseek-ai/dsh@0.1.5-rc.2` 及 14 个 client 包解包（`dsh-client-ui-conversation` / `-trajectory` / `-chat` / `-renderer` / `-session` / `-layout` / `-sidebar` / `-sidebar-right` / `-slots` / `-settings` / `-workspace` / `-commands` / `-settings-plugins`、`dsh-client-store`、`dsh-api-session-controller`、`dsh`）
- `v011/` — 0.1.1-rc.2 基线解包（`dsh-client-runtime` / `-ui-slots` / `-ui-conversation` / `-ui-trajectory` / `-ui-layout`）
- `package/` — `@canglongcl/dsh-web-review@0.6.0` 解包
- 本文件 `REPORT-p2h-bridge-detach-better-sidebar.md`
