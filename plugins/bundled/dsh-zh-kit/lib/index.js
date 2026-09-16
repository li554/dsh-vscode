/**
 * dsh-zh-kit — host half.
 *
 * Two fused responsibilities:
 *  1. Chinese-first agent prompting (from deepseek-harness-zh-cn, Apache-2.0):
 *     on every turn's first step, append a <system-reminder> user message that
 *     asks the model to reason and answer in Simplified Chinese.
 *  2. Keep this loader entry enabled so `dsh-client-modules` discovers the
 *     package's `dsh.client` declaration and serves lib/client.js (the
 *     trajectory-view localization) to the browser (from dsh-trajectory-zh).
 *
 * All browser-side work is a pure DOM projection and never enters a model
 * request.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const name = 'dsh-zh-kit'

export const inject = []

const ZH_DIRECTIVE = [
  '始终使用简体中文进行思考（reasoning）与所有最终回答。',
  '计划、工具调用、总结、代码注释同样使用简体中文。',
  '思考链与轨迹中的工具调用一律以中文称呼工具用途（例如「读取文件」而非 read），工具名英文原文仅保留在实际函数调用参数中。',
  '仅代码、命令、文件路径、变量名、API 名称等必须原样保留的内容使用英文。',
  '除非用户明确要求其他语言，否则本规则优先。',
].join('\n')

export function apply(ctx) {
  ctx.on('agent/pre-step', async ({ step, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    if (step !== 1) return decision
    return {
      kind: 'enter',
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text: `<system-reminder>\n${ZH_DIRECTIVE}\n</system-reminder>` }],
          source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text: ZH_DIRECTIVE }] },
        }),
      ],
    }
  }, { prepend: true })
}