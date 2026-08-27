/**
 * Locale strings for the panel surfaces (zh/en). The client registers the
 * dictionary through the locale service like the sibling plugins; copy is
 * deliberately short and technical.
 * @module dsh-aionui-panel/client/locales
 */
declare const zh: {
    readonly 'explorer.tabs.files': "文件";
    readonly 'explorer.tabs.changes': "变更";
    readonly 'explorer.search.placeholder': "按文件名搜索";
    readonly 'explorer.search.searching': "搜索中…";
    readonly 'explorer.search.empty': "没有匹配的文件";
    readonly 'explorer.search.error': "搜索失败";
    readonly 'explorer.search.truncated': "结果过多，仅显示前 {count} 条";
    readonly 'explorer.tree.empty': "项目为空";
    readonly 'explorer.collapse': "收起面板";
    readonly 'explorer.expand': "展开面板";
    readonly 'explorer.maximize': "最大化文件面板";
    readonly 'explorer.restore': "还原面板";
    readonly 'explorer.openPreview': "打开预览";
    readonly 'explorer.drag.dropHint': "松手插入文件路径";
    readonly 'scm.repositories': "存储库";
    readonly 'scm.changes': "变更";
    readonly 'scm.staged': "已暂存";
    readonly 'scm.unstaged': "变更";
    readonly 'scm.untracked': "未跟踪";
    readonly 'scm.conflicted': "冲突";
    readonly 'scm.stage': "暂存";
    readonly 'scm.unstage': "取消暂存";
    readonly 'scm.discard': "放弃更改";
    readonly 'scm.stageAll': "全部暂存";
    readonly 'scm.discardAll': "全部放弃";
    readonly 'scm.empty': "没有更改";
    readonly 'scm.notRepo': "当前目录不是 git 仓库";
    readonly 'scm.gitMissing': "未检测到 git，请先安装 git 后重试";
    readonly 'scm.loading': "读取状态中…";
    readonly 'scm.failed': "操作失败";
    readonly 'scm.viewList': "列表视图";
    readonly 'scm.viewTree': "树视图";
    readonly 'scm.discardConfirmTracked': "放弃对 {count} 个文件的更改？此操作不可恢复。";
    readonly 'scm.discardConfirmUntracked': "删除 {count} 个未跟踪文件？此操作不可恢复。";
    readonly 'preview.noTabs': "没有打开的预览";
    readonly 'preview.newUrlTab': "新建 URL 预览";
    readonly 'preview.collapsePanel': "收起预览面板";
    readonly 'preview.maximize': "最大化预览面板";
    readonly 'preview.restore': "还原面板";
    readonly 'preview.source': "源码";
    readonly 'preview.preview': "预览";
    readonly 'preview.editor': "编辑器";
    readonly 'preview.split': "分屏";
    readonly 'preview.refresh': "刷新";
    readonly 'preview.refresh.updated': "文件已在磁盘更新";
    readonly 'preview.save': "保存";
    readonly 'preview.download': "下载";
    readonly 'preview.copyCode': "复制代码";
    readonly 'preview.copyCodeDone': "已复制";
    readonly 'preview.openExternal': "在系统应用中打开";
    readonly 'preview.dirty': "未保存的更改";
    readonly 'preview.closeLeft': "关闭左侧";
    readonly 'preview.closeRight': "关闭右侧";
    readonly 'preview.closeOthers': "关闭其他";
    readonly 'preview.closeAll': "关闭全部";
    readonly 'preview.closeConfirmTitle': "关闭未保存的标签页";
    readonly 'preview.closeConfirmBody': "{count} 个标签页有未保存的更改，关闭将丢失这些更改。";
    readonly 'preview.saved': "已保存";
    readonly 'preview.saveConflict': "文件已在磁盘上被修改，保存冲突：请刷新后重试";
    readonly 'preview.errorOversized': "文件过大，仅加载前 80,000 字符";
    readonly 'preview.unsupported': "此格式暂不支持预览";
    readonly 'preview.downloadHint': "可在系统应用中打开或下载查看";
    readonly 'preview.url.placeholder': "输入网址，回车打开";
    readonly 'preview.url.hint': "按 Esc 还原";
    readonly 'common.cancel': "取消";
    readonly 'common.confirm': "确定";
    readonly 'common.close': "关闭";
    readonly 'common.delete': "删除";
    readonly 'common.copyPath': "复制路径";
    readonly 'common.copied': "已复制";
    readonly 'explorer.menu.copyPath': "复制路径";
    readonly 'explorer.menu.copyName': "复制名称";
    readonly 'explorer.menu.reveal': "在文件管理器中显示";
    readonly 'explorer.menu.openWithDefault': "用默认应用打开";
    readonly 'explorer.menu.rename': "重命名";
    readonly 'explorer.menu.newFile': "新建文件";
    readonly 'explorer.menu.newFolder': "新建文件夹";
    readonly 'explorer.menu.delete': "删除";
    readonly 'explorer.rename.title': "重命名";
    readonly 'explorer.newFile.title': "新建文件";
    readonly 'explorer.newFolder.title': "新建文件夹";
    readonly 'explorer.deleteConfirmTitle': "删除确认";
    readonly 'explorer.deleteConfirmBody': "确定要删除「{name}」吗？此操作不可恢复。";
    readonly 'explorer.opFailed': "操作失败";
    readonly 'settings.title': "侧边卡片";
    readonly 'settings.description': "右侧面板由侧边卡片提供，来自 DSH-better-sidebar（github.com/omdsh-dev/DSH-better-sidebar）。";
    readonly 'settings.sourcePrefix': "侧边卡片（右侧面板）由外部插件 DSH-better-sidebar 提供，来自 ";
    readonly 'settings.sourceSuffix': "。以下为常用设置，改动即时生效。";
    readonly 'settings.generalTitle': "常规";
    readonly 'settings.openByDefault': "新会话默认打开";
    readonly 'settings.openByDefaultHint': "新建会话时自动展开侧边卡片；已存在的会话保持各自布局";
    readonly 'settings.width': "默认宽度占比";
    readonly 'settings.widthHint': "新建会话时侧边卡片占窗口宽度的百分比 (20–60)";
    readonly 'settings.openPath': "聊天区文件在侧边栏打开";
    readonly 'settings.openPathHint': "在聊天里点击文件链接（工具行、产物列表、文件提及）时，在侧边栏编辑器中打开，不再调用系统默认应用";
    readonly 'settings.titleBar': "位置兼容模式";
    readonly 'settings.titleBarHint': "为 Windows 右上角的原生标题栏预留空间：侧边栏按钮与侧边栏内容整体下移，避免被标题栏遮挡";
    readonly 'settings.tabsTitle': "侧边栏内容";
    readonly 'settings.viewersTitle': "文件预览";
    readonly 'settings.prefsLoading': "设置加载中…";
    readonly 'settings.prefsUnavailable': "侧边卡片设置不可用：未安装 dsh-better-sidebar 或其设置路由不可达。";
    readonly 'settings.overridden': "已覆盖";
    readonly 'settings.reset': "恢复默认";
    readonly 'settings.notExposed': "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。";
    readonly 'settings.readOnly': "当前部署的设置只读。";
    readonly 'settings.inherit': "继承";
    readonly 'settings.on': "开";
    readonly 'settings.off': "关";
    readonly 'settings.expand': "展开设置";
    readonly 'settings.collapse': "收起设置";
    readonly 'settings.save': "保存";
    readonly 'settings.saving': "保存中…";
    readonly 'settings.discard': "放弃";
    readonly 'settings.unsaved': "未保存";
    readonly 'settings.saveFailed': "部署未接受这些值，已保留供你修改。";
    readonly 'settings.invalidNumber': "请输入数字，留空则使用默认值。";
};
export type AionUiPanelKey = keyof typeof zh;
/** The dictionary namespace this plugin owns. */
export declare const NS = "aionui-panel";
/** Format one copy string with {name} placeholders. */
export declare function format(template: string, params: Record<string, string | number>): string;
/** Simple dictionary access (zh/en by a global flag the client sets). */
export declare const dictionaries: Record<'zh' | 'en', Record<AionUiPanelKey, string>>;
/** Set the active language (the client mirrors the locale service). */
export declare function setLanguage(language: string): void;
/** Translate one key with optional params. */
export declare function t(key: AionUiPanelKey, params?: Record<string, string | number>): string;
export {};
//# sourceMappingURL=locales.d.ts.map