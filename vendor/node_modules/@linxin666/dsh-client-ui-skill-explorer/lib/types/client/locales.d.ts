/**
 * skill-explorer surface copy: zh is the key source, en mirrors every key.
 */
export declare const zh: {
    readonly 'entry.label': "技能中心";
    readonly 'entry.tooltip': "技能中心：浏览与管理已加载的 skill";
    readonly 'panel.title': "技能中心";
    readonly 'tab.list': "技能";
    readonly 'tab.create': "创建";
    readonly 'group.bundled': "系统内置";
    readonly 'group.project-dsh': "项目技能（.dsh/skills）";
    readonly 'group.project-agents': "项目技能（.agents/skills）";
    readonly 'group.custom': "自定义目录";
    readonly 'group.user-dsh': "用户技能（~/.dsh/skills）";
    readonly 'group.user-agents': "用户技能（~/.agents/skills）";
    readonly 'group.runtime': "运行时注册";
    readonly 'groupHint.bundled': "DSH 随附与插件提供的技能";
    readonly 'groupHint.project-dsh': "仅当前项目";
    readonly 'groupHint.project-agents': "仅当前项目";
    readonly 'groupHint.custom': "customSkillDirs 配置";
    readonly 'groupHint.user-dsh': "本机所有项目";
    readonly 'groupHint.user-agents': "本机所有项目";
    readonly 'groupHint.runtime': "插件代码内嵌注册";
    readonly 'list.loading': "加载中…";
    readonly 'list.loadFailed': "加载失败：{error}";
    readonly 'list.empty': "当前没有已加载的 skill。";
    readonly 'list.count': "{count} 个";
    readonly 'list.when': "适用：{when}";
    readonly 'list.invokable': "可调用：{marks}";
    readonly 'list.linked': "软链接";
    readonly 'list.mark.model': "模型";
    readonly 'list.mark.user': "用户";
    readonly 'list.enabled': "已启用：模型可调用（点击禁用）";
    readonly 'list.disabled': "已禁用：模型不可调用（点击启用）";
    readonly 'list.toggleFailed': "操作失败：{error}";
    readonly 'list.delete': "删除";
    readonly 'list.deleteConfirm': "删除技能「{name}」？将移入 .trash。";
    readonly 'list.deleteFailed': "删除失败：{error}";
    readonly 'create.root': "创建位置";
    readonly 'create.root.user': "用户技能（~/.dsh/skills，所有项目可用）";
    readonly 'create.root.project': "项目技能（当前项目 .dsh/skills）";
    readonly 'create.name': "技能名（kebab-case，与文件目录同名）";
    readonly 'create.namePlaceholder': "如 my-workflow";
    readonly 'create.description': "描述（模型判断触发条件的依据）";
    readonly 'create.whenToUse': "适用场景（可选）";
    readonly 'create.content': "指令内容（SKILL.md 正文，Markdown）";
    readonly 'create.submit': "创建技能";
    readonly 'create.empty': "技能名/描述/内容不能为空";
    readonly 'create.created': "已创建：{path}";
    readonly 'create.failed': "创建失败：{error}";
    readonly 'create.note': "创建后立即生效（skill-filesystem 会热扫描）。内容会作为指令注入模型上下文——不要写入敏感信息。";
    readonly refresh: "刷新";
    readonly close: "关闭";
    readonly cwd: "cwd: {cwd}";
};
export declare const en: Record<keyof typeof zh, string>;
/** Locale key union for the slot map. */
export type SkillExplorerKey = keyof typeof zh;
