/**
 * dsh-recall-plugin — 配置域（ctx 绑定的工厂，无模块级副作用）
 *
 * 三层配置解析（官方 settings 模型，见 dsh-settings README）：
 *   schema 默认值（Config）→ 组合 base（cordis.patch.yml insert 行 config
 *   键）→ 用户文档（设置页「插件配置」卡片写入，dsh-settings 持久化）。
 * 环境变量 DSH_RECALL_GC_SNAPS / DSH_RECALL_GC_HOURS 保留为最高优先级
 * 覆盖：已用它们调档的用户（含冒烟测试脚本）升级后行为不漂移；设了 env
 * 的字段在设置卡片里锁定不可编辑。
 *
 * Config 同时承担两个角色：cordis 入口配置校验（index.js re-export 给
 * 加载器，非法配置在插件加载时响亮失败）与 settings namespace
 * 「dsh-recall」的注册 schema（installSettingsSection，见 index.js）。
 */

import Schema from '@deepseek-ai/schemastery'

export const Config = Schema.object({
  gcSnaps: Schema.number().default(50).description('每积累多少条快照触发一次 git gc'),
  gcHours: Schema.number().default(24).description('距上次 gc 超过多少小时触发（与条数先到先触发）'),
  maxFileBytes: Schema.number().default(104857600).description('超过该字节数的文件不进快照、不被回退触碰'),
  // 排除表必须同时覆盖两种存储目录名：降级存储是项目内 .dsh-recall-snapshots/，
  // 而 home 存储目录名是 dsh-recall-snapshots/（无点）——工作区 root 恰为
  // HOME 时（容器 root=/root 等）它落在工作区内，漏排除会让 git add -A
  // 把影子仓库自己吞进去、快照全部失败（issue #6）
  baseExcludes: Schema.array(Schema.string()).default(['.git', 'node_modules/', '.dsh-recall-snapshots/', 'dsh-recall-snapshots/']).description('基础排除表（gitignore 语法，优先级低于 exclude.txt）'),
  refillDraft: Schema.boolean().default(true).description('撤回后把被撤回的消息文本回填到输入框'),
})

// schema 默认值的运行时镜像：settings 服务未组装时 createConfig 直接以
// 入口 config 解析，这组兜底与 Config 保持一致（改默认值两处同步改）
const BASE_EXCLUDES = ['.git', 'node_modules/', '.dsh-recall-snapshots/', 'dsh-recall-snapshots/']

export function createConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {}

  function pickNumber(value, fallback, min) {
    const n = typeof value === 'number' ? value : parseInt(String(value == null ? '' : value), 10)
    if (!Number.isFinite(n) || n < min) return fallback
    return n
  }

  // 环境变量优先（向后兼容），其次 config，最后默认值
  const gcSnaps = pickNumber(process.env.DSH_RECALL_GC_SNAPS, pickNumber(cfg.gcSnaps, 50, 1), 1)
  const gcHours = pickNumber(process.env.DSH_RECALL_GC_HOURS, pickNumber(cfg.gcHours, 24, 1), 1)
  const maxFileBytes = pickNumber(cfg.maxFileBytes, 104857600, 1024)

  const baseExcludes = Array.isArray(cfg.baseExcludes) && cfg.baseExcludes.length
    ? cfg.baseExcludes.filter((p) => typeof p === 'string' && p.trim())
    : BASE_EXCLUDES

  const refillDraft = typeof cfg.refillDraft === 'boolean' ? cfg.refillDraft : true

  return { gcSnaps, gcHours, maxFileBytes, baseExcludes, refillDraft }
}
