/**
 * chat-recovery UI copy. The zh dictionary is the key source; the en side
 * must carry the exact same key set (typed against it below).
 */
export declare const zh: {
    readonly 'edit.button': "编辑";
    readonly 'edit.hint': "保存后从此消息之前的位置创建分支并重新生成，原会话历史保留。";
    readonly 'edit.cancel': "取消";
    readonly 'edit.save': "保存并重新生成";
    readonly 'edit.saving': "正在创建分支…";
    readonly 'edit.failed': "保存失败：{reason}";
    readonly 'retry.button': "重试";
    readonly 'retry.cancel': "取消重试";
    readonly 'retry.retryNow': "立即重试";
    readonly 'retry.waiting': "自动重试 {attempt}/{max}，约 {seconds}s 后";
    readonly 'retry.running': "自动重试 {attempt}/{max} 进行中…";
    readonly 'retry.manualRunning': "正在重试…";
    readonly 'retry.failed': "重试未通过：{reason}";
    readonly 'retry.exhausted': "已重试 {max} 次仍失败：{reason}";
    readonly 'retry.manualRetry': "手动重试";
    readonly 'retry.forkHint': "重试会从失败消息之前创建新的会话分支，后续尝试在该分支内重跑；原会话保持不变，失败的分支会保留在会话列表中。";
};
export type ChatRecoveryKey = keyof typeof zh;
export declare const en: Record<ChatRecoveryKey, string>;
