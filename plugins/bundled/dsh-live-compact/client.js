window.__ModuleLoader__.load({
  id: "dsh-live-compact",
  factory(require) {
    /** 全走宿主原生接口的设置界面。 */
    const React = require("react");
    const { SettingsFormModel, settingsNumberField, SettingsForm, SettingsValueField, Switch } = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;

    const NS = "compaction-spine";
    const GROUPS = [
      { id: "basic", keys: ["minTokens", "pointerTokens", "keepRounds"] },
      {
        id: "advanced",
        keys: [
          "chunkMin", "chunkMax", "keepRoundTokens", "bigGate", "cooldownMs",
          "thresholdRatio", "headroomTokens", "retainTokens", "compactionRetries",
        ],
      },
    ];
    const KEYS = GROUPS.flatMap((group) => group.keys);
    const PRESET_FIELD = {
      field: "takeoverPresets",
      format: (value) => String(value),
      parse: (text) => ({ kind: "set", value: text === "true" }),
    };
    const LABELS = {
      minTokens: ["起切 token 数", "默认 20000"],
      pointerTokens: ["大结果只留指针", "0 = 跟随一刀上限"],
      keepRounds: ["保留原文轮数", "至少 1 轮，默认 3"],
      chunkMin: ["一刀最小 token", "默认 1000"],
      chunkMax: ["一刀最大 token", "默认 32000"],
      keepRoundTokens: ["收尾停止线", "默认 32000"],
      bigGate: ["绝对停切线", "默认 650000"],
      cooldownMs: ["官方压缩后冷却 ms", "0 = 只跳过一次"],
      thresholdRatio: ["官方大压缩触发比例", "默认 0.8"],
      headroomTokens: ["官方大压缩预留", "默认 65536"],
      retainTokens: ["官方大压缩保留", "默认 8192"],
      compactionRetries: ["官方大压缩重试", "默认 0"],
    };

    const zh = {
      takeoverPresets: "接管官方预设",
      takeoverHint: "将官方预设中的压缩引擎换成本插件。保存后仅影响新加载的预设；已有会话需重建。关闭不影响根层压缩引擎。",
      summary: "20000 起切、3 轮留原文、650000 停",
      basic: "常用",
      advanced: "高级设置",
      save: "保存",
      saving: "保存中…",
      invalid: "请填有效数字；留空清除覆盖，使用环境变量或默认值。",
      unavailable: "当前配置不可写",
      saveFailed: "保存失败，修改已保留，请检查后重试。",
      overridden: "已覆盖",
      reset: "恢复默认",
      unavailableHost: "宿主没有提供这一项配置",
    };
    const en = {
      takeoverPresets: "Take over official presets",
      takeoverHint: "Replace compression inside official presets. Applies to newly loaded presets after saving; recreate existing sessions. The root engine stays active when off.",
      summary: "cuts at 20000, keeps 3 rounds, stops at 650000",
      basic: "Common",
      advanced: "Advanced",
      save: "Save",
      saving: "Saving…",
      invalid: "Enter a valid number; leave blank to use the environment or default.",
      unavailable: "Configuration is not writable",
      saveFailed: "Save failed; your edits have been kept.",
      overridden: "Overridden",
      reset: "Reset to default",
      unavailableHost: "The host does not serve this namespace",
    };

    function SettingsPage(props) {
      const { t } = props;
      const state = props.useLiveCompact((snapshot) => snapshot);
      if (props.view === "summary") return t("summary");
      const section = (group) => group.keys.map((name) => {
        const [label, hint] = LABELS[name];
        return h(SettingsValueField, {
          key: name,
          id: `live-compact-${name}`,
          label,
          hint,
          numeric: true,
          disabled: !state.writable || state.saving,
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          invalidLabel: t("invalid"),
          ...state[name],
          onEdit: (text) => props.edit(name, text),
          onReset: () => props.resetField(name),
        });
      });
      return h(SettingsForm, {
        state,
        labels: {
          unavailable: t("unavailableHost"),
          readOnly: t("unavailable"),
          saveFailed: t("saveFailed"),
          save: t("save"),
          saving: t("saving"),
        },
        onSave: props.save,
        onDiscard: props.discard,
      },
      h("h4", null, t("basic")),
      h("label", { style: { display: "flex", alignItems: "center", gap: "0.75rem" } },
        t("takeoverPresets"),
        h(Switch, {
          label: t("takeoverPresets"),
          checked: state.takeoverPresets.text === "true",
          disabled: !state.writable || state.saving,
          onChange: (checked) => props.edit("takeoverPresets", String(checked)),
        })),
      h("p", null, t("takeoverHint")),
      section(GROUPS[0]),
      h("details", null,
        h("summary", null, t("advanced")),
        section(GROUPS[1])));
    }

    return {
      inject: ["slots", "locale", "configForms"],
      apply(ctx) {
        const t = ctx.locale.bind("liveCompact");
        ctx.effect(() => ctx.locale.register("liveCompact", { zh, en }), "live-compact: settings dictionary");
        const model = new SettingsFormModel(ctx.configForms.get(NS), [PRESET_FIELD, ...KEYS.map(settingsNumberField)]);
        const store = model.bind(() => ({
          ...model.shell(),
          takeoverPresets: model.field("takeoverPresets"),
          ...Object.fromEntries(KEYS.map((name) => [name, model.field(name)])),
        }));
        ctx.effect(() => () => model.dispose(), "live-compact: form subscription");
        ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject("plugins.row.config", () => ctx.slots.register(
          {
            name: "plugins.row.config",
            key: "dsh-live-compact#compaction-spine",
            locale: "liveCompact",
            inject: () => ({ hooks: { liveCompact: store }, ...model.actions() }),
          },
          SettingsPage,
        ))), "live-compact: settings page");
      },
    };
  },
});
