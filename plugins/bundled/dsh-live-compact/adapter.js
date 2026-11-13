/**
 * 把所有对上游 DSH 的依赖收敛到此处，以减轻未来版本变更的适配压力。
 * 后续新增的上游依赖也都集中在这里，其它文件不出现 DSH 包名。
 * Every upstream DSH dependency belongs in this file, including future ones.
 */

export const STOCK_ENGINE = "@deepseek-ai/dsh-compaction-basic";

export const loadBase = () => import("@deepseek-ai/dsh-compaction-basic");

export const loadCompaction = () => import("@deepseek-ai/dsh-compaction");

export const loadLlm = () => import("@deepseek-ai/dsh-llm");

// 官方设置界面读的是 schemastery schema，构造器同样从这里取。
export const loadSchema = () => import("@deepseek-ai/schemastery");
