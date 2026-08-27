/**
 * dsh-pet locale dictionaries (zh/en).
 * @module @linxin666/dsh-pet/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "pet";
/** Chinese copy. */
export declare const zh: {
    readonly 'pet.feed': "喂食";
    readonly 'pet.hide': "隐藏";
    readonly 'pet.rename': "改名";
    readonly 'pet.confirm': "确定";
    readonly 'pet.namePlaceholder': "输入新名字";
    readonly 'pet.summon': "召唤{name}";
    readonly 'pet.rank': "亲密度 {rank}";
    readonly 'pet.points': "{points} 点";
    readonly 'pet.treats': "小鱼干 ×{n}";
    readonly 'pet.state.loading': "宠物正在赶来…";
    readonly 'pet.state.error': "宠物迷路了（连接失败）";
    readonly 'pet.renderer.unavailable': "这只宠物需要的渲染器（{renderer}）在当前版本不可用。";
    readonly 'pet.live2d.core-missing': "Live2D 核心未安装：请把官方 live2dcubismcore.min.js 放入 $DSH_HOME/pets/.runtime/ 后刷新（步骤见宠物插件 README）。";
    readonly 'pet.live2d.vendor-missing': "Live2D 组件缺失，请升级宠物插件。";
    readonly 'pet.live2d.load-failed': "Live2D 模型加载失败，请检查该宠物目录的完整性。";
    readonly 'pet.openSessionHint': "点击跳转到对应会话";
    readonly 'pet.moreSessions': "展开其余 {n} 个会话的气泡";
    readonly 'pet.collapseSessions': "收起会话气泡";
    readonly 'settings.title': "宠物";
    readonly 'settings.diagnosticsTitle': "宠物目录诊断";
    readonly 'settings.description': "选择宠物并调整它的显示布局。";
    readonly 'settings.pet': "宠物";
    readonly 'settings.petHint': "选择显示哪只宠物；每只宠物独立命名，可在宠物悬浮面板改名。";
    readonly 'settings.enabled': "启用宠物";
    readonly 'settings.enabledHint': "关闭后隐藏宠物并停止轮询，可在设置里重新启用。";
    readonly 'settings.decoration': "状态装饰";
    readonly 'settings.decorationHint': "在宠物状态气泡里显示喷水鲸鱼等状态装饰；关闭后气泡只剩文字。";
    readonly 'settings.visible': "显示宠物";
    readonly 'settings.visibleHint': "关闭后宠物隐藏，可从聊天输入区重新召唤。";
    readonly 'settings.size': "大小（px）";
    readonly 'settings.sizeHint': "精灵单元高度，范围 32–512。";
    readonly 'settings.right': "距右侧（px）";
    readonly 'settings.rightHint': "距视口右边缘的水平内缩距离。";
    readonly 'settings.bottom': "距底部（px）";
    readonly 'settings.bottomHint': "距视口底边的垂直内缩距离。";
    readonly 'settings.inherit': "继承";
    readonly 'settings.on': "开";
    readonly 'settings.off': "关";
    readonly 'settings.overridden': "已覆盖";
    readonly 'settings.reset': "恢复默认";
    readonly 'settings.notExposed': "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。";
    readonly 'settings.readOnly': "当前部署的设置只读。";
    readonly 'settings.expand': "展开设置";
    readonly 'settings.collapse': "收起设置";
    readonly 'settings.save': "保存";
    readonly 'settings.saving': "保存中…";
    readonly 'settings.discard': "放弃";
    readonly 'settings.unsaved': "未保存";
    readonly 'settings.saveFailed': "部署未接受这些值，已保留供你修改。";
    readonly 'settings.invalidNumber': "请输入数字，留空则使用默认值。";
};
/** English copy. */
export declare const en: {
    readonly 'pet.feed': "Feed";
    readonly 'pet.hide': "Hide";
    readonly 'pet.rename': "Rename";
    readonly 'pet.confirm': "OK";
    readonly 'pet.namePlaceholder': "Enter a new name";
    readonly 'pet.summon': "Summon {name}";
    readonly 'pet.rank': "Affinity {rank}";
    readonly 'pet.points': "{points} pts";
    readonly 'pet.treats': "Treats ×{n}";
    readonly 'pet.state.loading': "The pet is on its way…";
    readonly 'pet.state.error': "The pet is lost (connection failed)";
    readonly 'pet.renderer.unavailable': "This pet needs a renderer ({renderer}) that is not available in this build.";
    readonly 'pet.live2d.core-missing': "Live2D Cubism Core is not installed: place the official live2dcubismcore.min.js under $DSH_HOME/pets/.runtime/ and refresh (see the pet plugin README).";
    readonly 'pet.live2d.vendor-missing': "The Live2D component is missing; please update the pet plugin.";
    readonly 'pet.live2d.load-failed': "The Live2D model failed to load; check the pet directory is complete.";
    readonly 'pet.openSessionHint': "Click to jump to this session";
    readonly 'pet.moreSessions': "Expand {n} more session bubbles";
    readonly 'pet.collapseSessions': "Collapse session bubbles";
    readonly 'settings.title': "Pet";
    readonly 'settings.diagnosticsTitle': "Pet directory diagnostics";
    readonly 'settings.description': "Pick a pet and tune its display layout.";
    readonly 'settings.pet': "Pet";
    readonly 'settings.petHint': "Choose which pet shows. Names are stored per pet; rename from the pet hover panel.";
    readonly 'settings.enabled': "Enable the pet";
    readonly 'settings.enabledHint': "When off, the pet hides and polling stops; re-enable it here.";
    readonly 'settings.decoration': "Status decoration";
    readonly 'settings.decorationHint': "Show ornaments like the spouting whale inside the pet status bubbles; when off, bubbles stay text-only.";
    readonly 'settings.visible': "Show the pet";
    readonly 'settings.visibleHint': "When off, the pet hides; summon it again from the input row.";
    readonly 'settings.size': "Size (px)";
    readonly 'settings.sizeHint': "Sprite cell height, 32–512.";
    readonly 'settings.right': "Right inset (px)";
    readonly 'settings.rightHint': "Horizontal inset from the viewport right edge.";
    readonly 'settings.bottom': "Bottom inset (px)";
    readonly 'settings.bottomHint': "Vertical inset from the viewport bottom edge.";
    readonly 'settings.inherit': "Inherit";
    readonly 'settings.on': "On";
    readonly 'settings.off': "Off";
    readonly 'settings.overridden': "Overridden";
    readonly 'settings.reset': "Reset to default";
    readonly 'settings.notExposed': "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES allowlist and restart.";
    readonly 'settings.readOnly': "This deployment stores settings read-only.";
    readonly 'settings.expand': "Show settings";
    readonly 'settings.collapse': "Hide settings";
    readonly 'settings.save': "Save";
    readonly 'settings.saving': "Saving…";
    readonly 'settings.discard': "Discard";
    readonly 'settings.unsaved': "Unsaved";
    readonly 'settings.saveFailed': "The deployment did not accept these values; they were left for you to correct.";
    readonly 'settings.invalidNumber': "Enter a number, or leave blank to use the default.";
};
/** Key union for this namespace. */
export type PetKey = keyof typeof zh;
/** The settings-card slice of the pet dictionary. */
export type SettingsCardKey = PetKey;
/**
 * Active dictionary, picked by the document language at call time. The pet
 * mounts as a global floating surface (not a session-scoped slot), so it has
 * no framework locale seat and resolves its copy the same tiny way the
 * task-board's DOM-injected surface does.
 */
export declare function dictionary(): Record<PetKey, string>;
/**
 * Translate a key with optional `{name}` template params. Mirrors the slot
 * `Translate` contract `(key, params?) => string` so it can be handed to the
 * same components that used to receive the framework-injected `t` seat. The
 * key is typed loosely (`string`) so the function is assignable to the slot's
 * `TranslateNS<'pet'>` (whose key domain also spans the shared common
 * vocabulary); a missing key degrades to the key itself rather than throwing.
 */
export declare function t(key: string, params?: Record<string, unknown>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-pet UI copy. */
        pet: PetKey;
    }
}
//# sourceMappingURL=locales.d.ts.map